import { NextResponse } from "next/server";
import { requireStaffWithProjectPermission } from "@/lib/auth/staff-action";
import { generateClaudeSummaryForRecording } from "@/lib/slp/zoom-ai";
import { syncMeetingRecordFromV1 } from "@/lib/contact-history-v2/zoom/sync-from-v1";

export const dynamic = "force-dynamic";
export const maxDuration = 180;

type Params = { params: Promise<{ id: string }> };

export async function POST(_req: Request, { params }: Params) {
  await requireStaffWithProjectPermission([{ project: "slp", level: "edit" }]);
  const { id: idStr } = await params;
  const id = parseInt(idStr, 10);
  if (isNaN(id)) {
    return NextResponse.json({ ok: false, message: "invalid id" }, { status: 400 });
  }
  try {
    const result = await generateClaudeSummaryForRecording({ recordingId: id });
    // V2 MeetingRecordSummary (version=2: claude) へ反映
    await syncMeetingRecordFromV1({ scope: "slp", legacyRecordingId: id });
    return NextResponse.json({
      ok: true,
      summary: result.summary,
      model: result.model,
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, message: e instanceof Error ? e.message : "unknown" },
      { status: 500 }
    );
  }
}
