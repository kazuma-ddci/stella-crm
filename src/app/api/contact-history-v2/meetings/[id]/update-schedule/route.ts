import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaffWithProjectPermission } from "@/lib/auth/staff-action";
import { updateZoomScheduleForV2Meeting } from "@/lib/contact-history-v2/zoom/provision";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Params = { params: Promise<{ id: string }> };

/**
 * POST /api/contact-history-v2/meetings/[id]/update-schedule
 *
 * V2 ContactHistoryMeeting (id 指定) に紐づく Zoom 会議の予定日時 + topic を
 * Zoom API で更新する。フォーム保存後の確認ダイアログから呼び出される。
 * URL は変わらない (Zoom 仕様)。
 */
export async function POST(_req: Request, { params }: Params) {
  const { id: idStr } = await params;
  const id = parseInt(idStr, 10);
  if (isNaN(id)) {
    return NextResponse.json({ ok: false, message: "invalid id" }, { status: 400 });
  }

  const meeting = await prisma.contactHistoryMeeting.findUnique({
    where: { id },
    include: {
      contactHistory: { select: { project: { select: { code: true } } } },
    },
  });
  if (!meeting) {
    return NextResponse.json({ ok: false, message: "meeting not found" }, { status: 404 });
  }
  const projectCode = meeting.contactHistory.project.code;
  if (projectCode !== "stp" && projectCode !== "slp" && projectCode !== "hojo") {
    return NextResponse.json({ ok: false, message: "invalid project" }, { status: 400 });
  }
  await requireStaffWithProjectPermission([
    { project: projectCode as "stp" | "slp" | "hojo", level: "edit" },
  ]);

  try {
    const result = await updateZoomScheduleForV2Meeting({ meetingId: id });
    if (!result.ok) {
      return NextResponse.json({ ok: false, reason: result.reason }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { ok: false, message: e instanceof Error ? e.message : "unknown" },
      { status: 500 },
    );
  }
}
