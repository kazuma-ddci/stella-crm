import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

const JST_OFFSET_MIN = 9 * 60;

function formatJstForSeparator(d: Date | null | undefined): string {
  if (!d) return "";
  const jst = new Date(d.getTime() + JST_OFFSET_MIN * 60 * 1000);
  const y = jst.getUTCFullYear();
  const m = String(jst.getUTCMonth() + 1).padStart(2, "0");
  const day = String(jst.getUTCDate()).padStart(2, "0");
  const hh = String(jst.getUTCHours()).padStart(2, "0");
  const mm = String(jst.getUTCMinutes()).padStart(2, "0");
  return `${y}/${m}/${day} ${hh}:${mm}`;
}

function buildMinutesSeparator(params: {
  source: string | null;
  label: string | null;
  isPrimary: boolean;
  startedAt: Date | null;
}): string {
  const timestamp = formatJstForSeparator(params.startedAt);
  const label =
    params.source === "claude"
      ? "Claude生成議事録"
      : params.label ?? (params.isPrimary ? "メイン" : "追加Zoom");
  return timestamp ? `----- ${label} (${timestamp}〜) -----` : `----- ${label} -----`;
}

function removeExistingClaudeSection(existing: string): string {
  const pattern = /-----\s*Claude生成議事録[^\n]*-----\n[\s\S]*?(?=\n-----|$)/g;
  return existing.replace(pattern, "").replace(/\n{3,}/g, "\n\n").trim();
}

export async function appendMeetingRecordSummaryToMinutes(params: {
  meetingRecordId: number;
  overwriteClaude?: boolean;
  replaceAll?: boolean;
  tx?: Prisma.TransactionClient;
}): Promise<{ appended: boolean; alreadyAppended: boolean }> {
  const run = async (
    db: Prisma.TransactionClient,
  ): Promise<{ appended: boolean; alreadyAppended: boolean }> => {
    const record = await db.contactHistoryMeetingRecord.findUnique({
      where: { id: params.meetingRecordId },
      include: {
        meeting: {
          include: {
            contactHistory: { select: { id: true, meetingMinutes: true, scheduledStartAt: true } },
          },
        },
      },
    });
    if (!record) return { appended: false, alreadyAppended: false };

    const body = record.aiSummary?.trim();
    if (!body) return { appended: false, alreadyAppended: false };

    const isClaude = record.aiSummarySource === "claude";
    const alreadyAppended = !!record.minutesAppendedAt;
    if (alreadyAppended && !(isClaude && params.overwriteClaude) && !params.replaceAll) {
      return { appended: false, alreadyAppended: true };
    }

    const separator = buildMinutesSeparator({
      source: record.aiSummarySource,
      label: record.meeting.label,
      isPrimary: record.meeting.isPrimary,
      startedAt:
        record.recordingStartAt ??
        record.meeting.scheduledStartAt ??
        record.meeting.contactHistory.scheduledStartAt,
    });
    const chunk = `${separator}\n${body}`;

    let baseText = record.meeting.contactHistory.meetingMinutes ?? "";
    if (params.replaceAll) {
      baseText = "";
    } else if (isClaude && alreadyAppended) {
      baseText = removeExistingClaudeSection(baseText);
    }

    const merged = baseText.trim().length === 0
      ? chunk
      : `${baseText.trimEnd()}\n\n${chunk}`;

    await db.contactHistoryV2.update({
      where: { id: record.meeting.contactHistory.id },
      data: { meetingMinutes: merged },
    });
    await db.contactHistoryMeetingRecord.update({
      where: { id: record.id },
      data: { minutesAppendedAt: new Date() },
    });

    return { appended: true, alreadyAppended };
  };

  if (params.tx) return run(params.tx);
  return prisma.$transaction((tx) => run(tx));
}
