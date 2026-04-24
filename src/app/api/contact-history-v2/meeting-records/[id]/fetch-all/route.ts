import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaffWithProjectPermission } from "@/lib/auth/staff-action";
import { fetchAllForRecording as fetchAllSlp } from "@/lib/slp/zoom-recording-processor";
import { fetchAllForRecording as fetchAllHojo } from "@/lib/hojo/zoom-recording-processor";
import { syncMeetingRecordFromV1 } from "@/lib/contact-history-v2/zoom/sync-from-v1";
import { fetchRecordingMetadata } from "@/lib/zoom/recording";
import {
  processZoomRecordingForV2,
  processMeetingSummaryForV2,
} from "@/lib/contact-history-v2/zoom/direct-processor";
import { logAutomationError } from "@/lib/automation-error";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

type Params = { params: Promise<{ id: string }> };

/**
 * POST /api/contact-history-v2/meeting-records/[id]/fetch-all
 *
 * V2 録画レコードに対して「録画・議事録・参加者」のまとめて取得を行う。
 *
 * 動作:
 *   - provider=zoom の場合のみ有効。他 provider は 400 を返す (将来 Phase で対応)。
 *   - V1 レコード (slpZoomRecording / hojoZoomRecording) が存在するときは
 *     V1 の fetchAllForRecording を実行 + syncMeetingRecordFromV1 で V2 に反映。
 *   - V1 レコードが無い (V2 単独発行) ときは fetchRecordingMetadata →
 *     processZoomRecordingForV2 で直接 V2 に書き込む。
 */
export async function POST(_req: Request, { params }: Params) {
  const { id: idStr } = await params;
  const id = parseInt(idStr, 10);
  if (isNaN(id)) {
    return NextResponse.json({ ok: false, message: "invalid id" }, { status: 400 });
  }

  const record = await prisma.contactHistoryMeetingRecord.findUnique({
    where: { id },
    include: {
      meeting: {
        include: {
          contactHistory: { select: { project: { select: { code: true } } } },
        },
      },
    },
  });
  if (!record) {
    return NextResponse.json(
      { ok: false, message: "record not found" },
      { status: 404 },
    );
  }

  const projectCode = record.meeting.contactHistory.project.code;
  if (projectCode !== "stp" && projectCode !== "slp" && projectCode !== "hojo") {
    return NextResponse.json({ ok: false, message: "invalid project" }, { status: 400 });
  }
  await requireStaffWithProjectPermission([
    { project: projectCode as "stp" | "slp" | "hojo", level: "edit" },
  ]);

  if (record.meeting.provider !== "zoom") {
    return NextResponse.json(
      {
        ok: false,
        message: `provider=${record.meeting.provider} はまだ対応していません`,
      },
      { status: 400 },
    );
  }

  const externalId = record.meeting.externalMeetingId;
  const hostStaffId = record.meeting.hostStaffId;
  if (!externalId || !hostStaffId) {
    return NextResponse.json(
      { ok: false, message: "externalMeetingId or hostStaffId が未設定です" },
      { status: 400 },
    );
  }

  const meetingIdBig = BigInt(externalId);

  try {
    // V1 レコード突合 → あれば V1 経由
    const v1Slp = await prisma.slpZoomRecording.findUnique({
      where: { zoomMeetingId: meetingIdBig },
      select: { id: true },
    });
    if (v1Slp) {
      const result = await fetchAllSlp(v1Slp.id);
      await syncMeetingRecordFromV1({ scope: "slp", legacyRecordingId: v1Slp.id });
      return NextResponse.json({ ok: true, via: "v1_slp", result });
    }

    const v1Hojo = await prisma.hojoZoomRecording.findUnique({
      where: { zoomMeetingId: meetingIdBig },
      select: { id: true },
    });
    if (v1Hojo) {
      const result = await fetchAllHojo(v1Hojo.id);
      await syncMeetingRecordFromV1({ scope: "hojo", legacyRecordingId: v1Hojo.id });
      return NextResponse.json({ ok: true, via: "v1_hojo", result });
    }

    // V2 単独: Zoom API から payload を取ってきて direct processor で処理
    const payload = await fetchRecordingMetadata({
      hostStaffId,
      meetingId: meetingIdBig,
    });
    if (payload) {
      const result = await processZoomRecordingForV2(payload);
      return NextResponse.json({ ok: true, via: "v2_direct", result });
    }

    // 録画なし → status 更新し、AI要約 / 参加者だけ試みる
    await prisma.contactHistoryMeetingRecord.update({
      where: { id },
      data: {
        downloadStatus: "no_recording",
        downloadError: "Zoom側に録画が存在しないか削除済みです",
      },
    });
    if (record.meeting.externalMeetingUuid) {
      await processMeetingSummaryForV2({
        meetingId: meetingIdBig,
        meetingUuid: record.meeting.externalMeetingUuid,
      });
    }
    return NextResponse.json({ ok: true, via: "v2_direct_no_recording" });
  } catch (e) {
    await logAutomationError({
      source: "contact-history-v2-fetch-all",
      message: "V2 まとめて取得失敗",
      detail: {
        recordId: id,
        error: e instanceof Error ? e.message : String(e),
      },
    });
    return NextResponse.json(
      { ok: false, message: e instanceof Error ? e.message : "unknown" },
      { status: 500 },
    );
  }
}
