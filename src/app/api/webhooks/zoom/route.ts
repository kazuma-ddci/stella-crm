import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  verifyZoomWebhookSignature,
  generateUrlValidationResponse,
} from "@/lib/zoom/webhook";
import {
  processZoomRecordingCompleted,
  processMeetingSummaryCompleted,
} from "@/lib/slp/zoom-recording-processor";
import {
  processHojoZoomRecordingCompleted,
  processHojoMeetingSummaryCompleted,
} from "@/lib/hojo/zoom-recording-processor";
import type { ZoomRecordingPayload } from "@/lib/zoom/recording";
import { logAutomationError } from "@/lib/automation-error";
import { syncMeetingRecordFromV1 } from "@/lib/contact-history-v2/zoom/sync-from-v1";

/**
 * meetingId から SLP / HOJO のどちらにヒットするかを判定。
 * SLPファースト（既存挙動維持）。どちらにもなければ null。
 */
async function resolveRecordingScope(
  meetingId: bigint
): Promise<"slp" | "hojo" | null> {
  const slp = await prisma.slpZoomRecording.findUnique({
    where: { zoomMeetingId: meetingId },
    select: { id: true },
  });
  if (slp) return "slp";
  const hojo = await prisma.hojoZoomRecording.findUnique({
    where: { zoomMeetingId: meetingId },
    select: { id: true },
  });
  if (hojo) return "hojo";
  return null;
}

/**
 * V1 processor 完了後に V2 ContactHistoryMeetingRecord / MeetingRecordSummary へ
 * 内容を転記する。V2 meeting が未作成 (新規フォーム経由で externalMeetingId 未設定等)
 * の場合はサイレントスキップ。
 */
async function runV2Sync(
  scope: "slp" | "hojo",
  meetingId: bigint,
): Promise<void> {
  const legacyRecordingId =
    scope === "slp"
      ? (
          await prisma.slpZoomRecording.findUnique({
            where: { zoomMeetingId: meetingId },
            select: { id: true },
          })
        )?.id ?? null
      : (
          await prisma.hojoZoomRecording.findUnique({
            where: { zoomMeetingId: meetingId },
            select: { id: true },
          })
        )?.id ?? null;

  if (!legacyRecordingId) return;

  const result = await syncMeetingRecordFromV1({ scope, legacyRecordingId });
  if (!result.ok && result.reason && result.reason !== "v2_meeting_not_found") {
    await logAutomationError({
      source: "contact-history-v2-zoom-sync",
      message: `V1→V2 sync 失敗 (${scope}): ${result.reason}`,
      detail: { legacyRecordingId, meetingId: meetingId.toString() },
    });
  }
}

export const dynamic = "force-dynamic";
export const maxDuration = 30;

type ZoomWebhookBody = {
  event: string;
  payload: {
    plainToken?: string;
    object?: ZoomRecordingPayload & Record<string, unknown>;
    account_id?: string;
  };
  event_ts?: number;
  download_token?: string;
};

/**
 * POST /api/webhooks/zoom
 * Zoomからの全Webhookを受けるエンドポイント。
 * - endpoint.url_validation: challenge応答
 * - recording.completed / recording.transcript_completed: 録画処理（fire-and-forget）
 * - meeting.deleted: ログのみ（CRM側の状態は既にキャンセル処理で初期化済みのはず）
 */
export async function POST(request: Request) {
  // 生bodyを取得（署名検証のため）
  const rawBody = await request.text();
  const signature = request.headers.get("x-zm-signature");
  const timestamp = request.headers.get("x-zm-request-timestamp");

  // URL validation challenge は署名検証前にも応答してよい（Zoom仕様）
  let body: ZoomWebhookBody;
  try {
    body = JSON.parse(rawBody) as ZoomWebhookBody;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  if (body.event === "endpoint.url_validation" && body.payload?.plainToken) {
    const resp = generateUrlValidationResponse(body.payload.plainToken);
    return NextResponse.json(resp);
  }

  // 署名検証
  if (!verifyZoomWebhookSignature({ rawBody, signature, timestamp })) {
    return NextResponse.json(
      { error: "invalid signature" },
      { status: 401 }
    );
  }

  // イベントに応じた処理
  try {
    if (
      body.event === "recording.completed" ||
      body.event === "recording.transcript_completed"
    ) {
      const obj = body.payload?.object;
      if (!obj) {
        return NextResponse.json({ error: "missing object" }, { status: 400 });
      }
      // fire-and-forget（長時間処理 – Zoom側にはすぐに200返す）
      const payload: ZoomRecordingPayload = {
        id: (obj as unknown as { id: string | number }).id,
        uuid: (obj as unknown as { uuid: string }).uuid,
        host_id: (obj as unknown as { host_id: string }).host_id,
        topic: (obj as unknown as { topic: string }).topic,
        start_time: (obj as unknown as { start_time?: string }).start_time,
        duration: (obj as unknown as { duration?: number }).duration,
        recording_files:
          (obj as unknown as { recording_files?: unknown[] }).recording_files as ZoomRecordingPayload["recording_files"] ??
          [],
      };
      const meetingIdForPayload =
        typeof payload.id === "string" ? BigInt(payload.id) : BigInt(payload.id);
      const scope = await resolveRecordingScope(meetingIdForPayload);
      if (scope === "slp") {
        processZoomRecordingCompleted(payload)
          .then(() => runV2Sync("slp", meetingIdForPayload))
          .catch(async (err) => {
            await logAutomationError({
              source: "zoom-webhook-recording-completed",
              message: `SLP録画処理失敗: ${err instanceof Error ? err.message : String(err)}`,
              detail: { meetingId: String(payload.id), event: body.event },
            });
          });
      } else if (scope === "hojo") {
        processHojoZoomRecordingCompleted(payload)
          .then(() => runV2Sync("hojo", meetingIdForPayload))
          .catch(async (err) => {
            await logAutomationError({
              source: "zoom-webhook-recording-completed",
              message: `HOJO録画処理失敗: ${err instanceof Error ? err.message : String(err)}`,
              detail: { meetingId: String(payload.id), event: body.event },
            });
          });
      }
      // scope=null(CRM管理外の会議) → スルー
      return NextResponse.json({ ok: true });
    }

    // ============================================
    // meeting.summary_completed: AI Companion 要約が出来た（数分後）
    // この時点で議事録を早期生成する
    // ============================================
    if (body.event === "meeting.summary_completed") {
      const obj = body.payload?.object as
        | { meeting_id?: string | number; meeting_uuid?: string }
        | undefined;
      const meetingIdRaw = obj?.meeting_id;
      const meetingUuid = obj?.meeting_uuid;
      if (!meetingIdRaw || !meetingUuid) {
        return NextResponse.json({ ok: true, ignored: "missing fields" });
      }
      const meetingId =
        typeof meetingIdRaw === "string"
          ? BigInt(meetingIdRaw)
          : BigInt(meetingIdRaw);
      const summaryScope = await resolveRecordingScope(meetingId);
      if (summaryScope === "slp") {
        processMeetingSummaryCompleted({ meetingId, meetingUuid })
          .then(() => runV2Sync("slp", meetingId))
          .catch(async (err) => {
            await logAutomationError({
              source: "zoom-webhook-summary-completed",
              message: `SLP AI要約処理失敗: ${err instanceof Error ? err.message : String(err)}`,
              detail: { meetingId: meetingId.toString(), meetingUuid },
            });
          });
      } else if (summaryScope === "hojo") {
        processHojoMeetingSummaryCompleted({ meetingId, meetingUuid })
          .then(() => runV2Sync("hojo", meetingId))
          .catch(async (err) => {
            await logAutomationError({
              source: "zoom-webhook-summary-completed",
              message: `HOJO AI要約処理失敗: ${err instanceof Error ? err.message : String(err)}`,
              detail: { meetingId: meetingId.toString(), meetingUuid },
            });
          });
      }
      return NextResponse.json({ ok: true });
    }

    if (body.event === "meeting.deleted") {
      // 予約キャンセル時に我々が消すケースが多いが、Zoom側単独削除にもログで対応
      return NextResponse.json({ ok: true });
    }

    // その他のイベントは黙ってスルー
    return NextResponse.json({ ok: true, ignored: body.event });
  } catch (err) {
    await logAutomationError({
      source: "zoom-webhook",
      message: `Webhook処理失敗: ${err instanceof Error ? err.message : String(err)}`,
      detail: { event: body.event },
    });
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
