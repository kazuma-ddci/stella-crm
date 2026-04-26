import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaffWithProjectPermission } from "@/lib/auth/staff-action";
import { recreateZoomWithNewHostForV2Meeting } from "@/lib/contact-history-v2/zoom/provision";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Params = { params: Promise<{ id: string }> };

/**
 * POST /api/contact-history-v2/meetings/[id]/recreate-with-new-host
 *
 * V2 ContactHistoryMeeting (id) のホスト変更後、旧ホストの Zoom 会議を削除し、
 * 新ホストで Zoom 会議を発行し直す。URL も変わる。
 *
 * body: { newHostStaffId: number } (オプショナル — 未指定時は meeting.hostStaffId を使う)
 */
export async function POST(req: Request, { params }: Params) {
  const { id: idStr } = await params;
  const id = parseInt(idStr, 10);
  if (isNaN(id)) {
    return NextResponse.json({ ok: false, message: "invalid id" }, { status: 400 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    newHostStaffId?: number;
  };

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

  const newHostStaffId = body.newHostStaffId ?? meeting.hostStaffId ?? null;
  if (newHostStaffId == null) {
    return NextResponse.json(
      { ok: false, message: "新ホスト未指定です" },
      { status: 400 },
    );
  }

  try {
    const result = await recreateZoomWithNewHostForV2Meeting({
      meetingId: id,
      newHostStaffId,
    });
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
