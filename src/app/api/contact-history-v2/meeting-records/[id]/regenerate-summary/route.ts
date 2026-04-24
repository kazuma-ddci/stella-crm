import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaffWithProjectPermission } from "@/lib/auth/staff-action";
import { generateClaudeSummaryForRecording } from "@/lib/slp/zoom-ai";
import { generateClaudeSummaryForHojoRecording } from "@/lib/hojo/zoom-ai";
import { syncMeetingRecordFromV1 } from "@/lib/contact-history-v2/zoom/sync-from-v1";

export const dynamic = "force-dynamic";
export const maxDuration = 180;

type Params = { params: Promise<{ id: string }> };

/**
 * POST /api/contact-history-v2/meeting-records/[id]/regenerate-summary
 *
 * V2 録画レコードに対する Claude 再要約生成。
 *
 * 動作:
 *   - V1 レコードが存在 (併走期間中) → V1 generateClaudeSummaryForRecording を
 *     プロジェクト別に呼び、syncMeetingRecordFromV1 で V2 に反映。
 *   - V1 レコードが無い V2 単独レコードは Phase D で対応 (現状 501)。
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
      { ok: false, message: "provider が zoom 以外は未対応" },
      { status: 400 },
    );
  }

  const externalId = record.meeting.externalMeetingId;
  if (!externalId) {
    return NextResponse.json(
      { ok: false, message: "externalMeetingId が未設定" },
      { status: 400 },
    );
  }

  try {
    const meetingIdBig = BigInt(externalId);

    const v1Slp = await prisma.slpZoomRecording.findUnique({
      where: { zoomMeetingId: meetingIdBig },
      select: { id: true },
    });
    if (v1Slp) {
      const result = await generateClaudeSummaryForRecording({ recordingId: v1Slp.id });
      await syncMeetingRecordFromV1({ scope: "slp", legacyRecordingId: v1Slp.id });
      return NextResponse.json({ ok: true, via: "v1_slp", model: result.model });
    }

    const v1Hojo = await prisma.hojoZoomRecording.findUnique({
      where: { zoomMeetingId: meetingIdBig },
      select: { id: true },
    });
    if (v1Hojo) {
      const result = await generateClaudeSummaryForHojoRecording({
        recordingId: v1Hojo.id,
      });
      await syncMeetingRecordFromV1({ scope: "hojo", legacyRecordingId: v1Hojo.id });
      return NextResponse.json({ ok: true, via: "v1_hojo", model: result.model });
    }

    // V2 単独レコードの Claude 再要約は次フェーズで対応
    return NextResponse.json(
      {
        ok: false,
        message:
          "V1 レコードが見つかりません。V2 単独レコードの Claude 再要約は次の実装で対応予定です。",
      },
      { status: 501 },
    );
  } catch (e) {
    return NextResponse.json(
      { ok: false, message: e instanceof Error ? e.message : "unknown" },
      { status: 500 },
    );
  }
}
