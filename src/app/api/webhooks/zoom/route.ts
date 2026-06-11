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

/**
 * meetingId から候補プロジェクトを判定。
 * 固定URLでは同じ meetingId が複数プロジェクト・複数接触履歴に存在しうるため、
 * 一つに絞らず各プロジェクト側の uuid/予定時刻マッチングへ渡す。
 */
async function resolveRecordingScopes(
  meetingId: bigint
): Promise<Array<"slp" | "hojo">> {
  const [slp, hojo] = await Promise.all([
    prisma.slpZoomRecording.findFirst({
      where: { zoomMeetingId: meetingId, deletedAt: null },
      select: { id: true },
    }),
    prisma.hojoZoomRecording.findFirst({
      where: { zoomMeetingId: meetingId, deletedAt: null },
      select: { id: true },
    }),
  ]);
  const scopes: Array<"slp" | "hojo"> = [];
  if (slp) scopes.push("slp");
  if (hojo) scopes.push("hojo");
  return scopes;
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
      const scopes = await resolveRecordingScopes(meetingIdForPayload);
      const downloadToken = body.download_token ?? null;
      for (const scope of scopes) {
        if (scope === "slp") {
          processZoomRecordingCompleted(payload, { downloadToken }).catch(async (err) => {
            await logAutomationError({
              source: "zoom-webhook-recording-completed",
              message: `SLP録画処理失敗: ${err instanceof Error ? err.message : String(err)}`,
              detail: { meetingId: String(payload.id), event: body.event },
            });
          });
        } else if (scope === "hojo") {
          processHojoZoomRecordingCompleted(payload, { downloadToken }).catch(async (err) => {
            await logAutomationError({
              source: "zoom-webhook-recording-completed",
              message: `HOJO録画処理失敗: ${err instanceof Error ? err.message : String(err)}`,
              detail: { meetingId: String(payload.id), event: body.event },
            });
          });
        }
      }
      // scopes=[](CRM管理外の会議) → スルー
      return NextResponse.json({ ok: true });
    }

    // ============================================
    // meeting.summary_completed: AI Companion 要約が出来た（数分後）
    // この時点で議事録を早期生成する
    // ============================================
    if (body.event === "meeting.summary_completed") {
      const obj = body.payload?.object as
        | {
            meeting_id?: string | number;
            meeting_uuid?: string;
            host_id?: string;
          }
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
      const summaryScopes = await resolveRecordingScopes(meetingId);
      for (const scope of summaryScopes) {
        if (scope === "slp") {
          processMeetingSummaryCompleted({
            meetingId,
            meetingUuid,
            hostZoomUserId: obj?.host_id ?? null,
          }).catch(async (err) => {
            await logAutomationError({
              source: "zoom-webhook-summary-completed",
              message: `SLP AI要約処理失敗: ${err instanceof Error ? err.message : String(err)}`,
              detail: { meetingId: meetingId.toString(), meetingUuid },
            });
          });
        } else if (scope === "hojo") {
          processHojoMeetingSummaryCompleted({
            meetingId,
            meetingUuid,
            hostZoomUserId: obj?.host_id ?? null,
          }).catch(async (err) => {
            await logAutomationError({
              source: "zoom-webhook-summary-completed",
              message: `HOJO AI要約処理失敗: ${err instanceof Error ? err.message : String(err)}`,
              detail: { meetingId: meetingId.toString(), meetingUuid },
            });
          });
        }
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
