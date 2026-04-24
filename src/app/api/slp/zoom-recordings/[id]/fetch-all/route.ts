import { NextResponse } from "next/server";
import { requireStaffWithProjectPermission } from "@/lib/auth/staff-action";
import { fetchAllForRecording } from "@/lib/slp/zoom-recording-processor";
import { syncMeetingRecordFromV1 } from "@/lib/contact-history-v2/zoom/sync-from-v1";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 録画DLが入るので5分まで許容

type Params = { params: Promise<{ id: string }> };

/**
 * POST /api/slp/zoom-recordings/[id]/fetch-all
 *
 * 未取得分（AI要約・録画ファイル・参加者・先方参加者抽出）をまとめて取りに行く。
 * 既に取得済みのものはスキップ。
 */
export async function POST(_req: Request, { params }: Params) {
  await requireStaffWithProjectPermission([{ project: "slp", level: "edit" }]);
  const { id: idStr } = await params;
  const id = parseInt(idStr, 10);
  if (isNaN(id)) {
    return NextResponse.json(
      { ok: false, message: "invalid id" },
      { status: 400 }
    );
  }
  try {
    const result = await fetchAllForRecording(id);
    // V2 ContactHistoryMeetingRecord/MeetingRecordSummary へ同期 (併走期間)
    await syncMeetingRecordFromV1({ scope: "slp", legacyRecordingId: id });
    return NextResponse.json({
      ok: true,
      result,
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, message: e instanceof Error ? e.message : "unknown" },
      { status: 500 }
    );
  }
}
