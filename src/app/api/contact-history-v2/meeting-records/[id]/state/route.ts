import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaffWithProjectPermission } from "@/lib/auth/staff-action";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

const ALLOWED_STATES = ["予定", "完了", "失敗"] as const;

/**
 * POST /api/contact-history-v2/meeting-records/[id]/state
 * ContactHistoryMeeting.state を手動変更する。
 * "取得中" は API 側が制御する状態のため、手動設定不可。
 */
export async function POST(req: Request, { params }: Params) {
  const { id: idStr } = await params;
  const id = parseInt(idStr, 10);
  if (isNaN(id)) {
    return NextResponse.json({ ok: false, message: "invalid id" }, { status: 400 });
  }

  const body = (await req.json().catch(() => null)) as { state?: string } | null;
  const state = body?.state;
  if (!state || !ALLOWED_STATES.includes(state as (typeof ALLOWED_STATES)[number])) {
    return NextResponse.json(
      { ok: false, message: "state は 予定/完了/失敗 のいずれか" },
      { status: 400 },
    );
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

  await prisma.contactHistoryMeeting.update({
    where: { id: record.meeting.id },
    data: { state },
  });

  return NextResponse.json({ ok: true, state });
}
