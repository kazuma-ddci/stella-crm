import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaffWithProjectPermission } from "@/lib/auth/staff-action";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/**
 * PATCH /api/contact-history-v2/meeting-records/[id]/summary
 *
 * 現行版 (isCurrent=true) の MeetingRecordSummary を編集保存する。
 * 編集は source を問わず許容 (zoom_ai_companion / claude / manual)。
 * 現行版が無い場合は version=2, source="manual" として新規作成。
 *
 * body: { summaryText: string }
 */
export async function PATCH(req: Request, { params }: Params) {
  const { id: idStr } = await params;
  const id = parseInt(idStr, 10);
  if (isNaN(id)) {
    return NextResponse.json({ ok: false, message: "invalid id" }, { status: 400 });
  }

  const body = (await req.json().catch(() => null)) as {
    summaryText?: string;
  } | null;
  if (!body?.summaryText || body.summaryText.trim().length === 0) {
    return NextResponse.json(
      { ok: false, message: "summaryText が空です" },
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
      summaries: { orderBy: { version: "desc" } },
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
  const session = await requireStaffWithProjectPermission([
    { project: projectCode as "stp" | "slp" | "hojo", level: "edit" },
  ]);

  const current = record.summaries.find((s) => s.isCurrent) ?? record.summaries[0];

  if (current) {
    await prisma.$transaction([
      prisma.meetingRecordSummary.update({
        where: { id: current.id },
        data: {
          summaryText: body.summaryText,
          generatedByStaffId: session.id,
          generatedAt: new Date(),
        },
      }),
      prisma.contactHistoryMeetingRecord.update({
        where: { id: record.id },
        data: {
          aiSummary: body.summaryText,
          aiSummaryGeneratedAt: new Date(),
        },
      }),
    ]);
    return NextResponse.json({ ok: true, summaryId: current.id });
  }

  // 現行版が無い → manual 新規作成 (version=2)
  const maxVersion = record.summaries.length > 0 ? record.summaries[0].version : 0;
  const created = await prisma.$transaction(async (tx) => {
    const s = await tx.meetingRecordSummary.create({
      data: {
        meetingRecordId: record.id,
        version: maxVersion + 1,
        summaryText: body.summaryText!,
        source: "manual",
        model: null,
        generatedByStaffId: session.id,
        generatedAt: new Date(),
        isCurrent: true,
      },
    });
    await tx.contactHistoryMeetingRecord.update({
      where: { id: record.id },
      data: {
        aiSummary: body.summaryText!,
        aiSummarySource: "manual",
        aiSummaryGeneratedAt: new Date(),
      },
    });
    return s;
  });

  return NextResponse.json({ ok: true, summaryId: created.id });
}
