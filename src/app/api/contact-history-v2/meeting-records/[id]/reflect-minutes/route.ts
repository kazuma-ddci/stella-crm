import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaffWithProjectPermission } from "@/lib/auth/staff-action";
import { appendMeetingRecordSummaryToMinutes } from "@/lib/contact-history-v2/meeting-minutes";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/**
 * POST /api/contact-history-v2/meeting-records/[id]/reflect-minutes
 *
 * MeetingRecord.aiSummary (現行版のキャッシュ) を ContactHistoryV2.meetingMinutes
 * に追記する。二重追記防止のため MeetingRecord.minutesAppendedAt を使う。
 *
 * body: { mode: "append" | "replace" } (デフォルト "append")
 */
export async function POST(req: Request, { params }: Params) {
  const { id: idStr } = await params;
  const id = parseInt(idStr, 10);
  if (isNaN(id)) {
    return NextResponse.json({ ok: false, message: "invalid id" }, { status: 400 });
  }

  const body = (await req.json().catch(() => ({}))) as { mode?: string };
  const mode: "append" | "replace" = body.mode === "replace" ? "replace" : "append";

  const record = await prisma.contactHistoryMeetingRecord.findUnique({
    where: { id },
    include: {
      meeting: {
        include: {
          contactHistory: {
            select: {
              id: true,
              project: { select: { code: true } },
            },
          },
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

  if (!record.aiSummary || record.aiSummary.trim().length === 0) {
    return NextResponse.json(
      { ok: false, message: "AI要約がまだ生成されていません" },
      { status: 400 },
    );
  }

  const result = await appendMeetingRecordSummaryToMinutes({
    meetingRecordId: record.id,
    overwriteClaude: record.aiSummarySource === "claude",
    replaceAll: mode === "replace",
  });

  return NextResponse.json({ ok: true, mode, ...result });
}
