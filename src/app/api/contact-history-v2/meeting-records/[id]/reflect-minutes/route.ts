import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaffWithProjectPermission } from "@/lib/auth/staff-action";

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
              meetingMinutes: true,
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

  const existing = record.meeting.contactHistory.meetingMinutes ?? "";
  const sourceLabel =
    record.aiSummarySource === "claude"
      ? "Claude 生成議事録"
      : record.aiSummarySource === "zoom_ai_companion"
        ? "Zoom AI Companion 要約"
        : "AI要約";
  const header = `--- ${sourceLabel} ---`;

  let newMinutes: string;
  if (mode === "replace") {
    newMinutes = `${header}\n${record.aiSummary}`;
  } else {
    if (existing.includes(record.aiSummary)) {
      // 既に同じ内容が追記済み → 何もしない
      return NextResponse.json({ ok: true, alreadyAppended: true });
    }
    newMinutes = existing
      ? `${existing}\n\n${header}\n${record.aiSummary}`
      : `${header}\n${record.aiSummary}`;
  }

  await prisma.$transaction([
    prisma.contactHistoryV2.update({
      where: { id: record.meeting.contactHistory.id },
      data: { meetingMinutes: newMinutes },
    }),
    prisma.contactHistoryMeetingRecord.update({
      where: { id: record.id },
      data: { minutesAppendedAt: new Date() },
    }),
  ]);

  return NextResponse.json({ ok: true, mode });
}
