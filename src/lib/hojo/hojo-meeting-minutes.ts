/**
 * HOJO 接触履歴の議事録テキスト統合ユーティリティ
 * SLP版の slp-meeting-minutes.ts と同じロジックで HojoZoomRecording / HojoContactHistory を扱う。
 */

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

export function buildMinutesSeparator(params: {
  label: string | null | undefined;
  isPrimary: boolean;
  startedAt: Date | null;
}): string {
  const label = params.label ?? (params.isPrimary ? "メイン" : "追加Zoom");
  const timestamp = formatJstForSeparator(params.startedAt);
  if (timestamp) {
    return `----- ${label} (${timestamp}〜) -----`;
  }
  return `----- ${label} -----`;
}

export function buildClaudeMinutesSeparator(startedAt: Date | null): string {
  const timestamp = formatJstForSeparator(startedAt);
  if (timestamp) {
    return `----- Claude生成議事録 (${timestamp}〜) -----`;
  }
  return `----- Claude生成議事録 -----`;
}

export function removeExistingClaudeSection(existing: string): string {
  const pattern =
    /-----\s*Claude生成議事録[^\n]*-----\n[\s\S]*?(?=\n-----|$)/g;
  return existing.replace(pattern, "").replace(/\n{3,}/g, "\n\n").trim();
}

export async function appendClaudeSummaryMinutesHojo(params: {
  recordingId: number;
  overwrite: boolean;
  tx?: Prisma.TransactionClient;
}): Promise<{ appended: boolean; alreadyAppended: boolean }> {
  const run = async (
    db: Prisma.TransactionClient
  ): Promise<{ appended: boolean; alreadyAppended: boolean }> => {
    const rec = await db.hojoZoomRecording.findUnique({
      where: { id: params.recordingId },
      select: {
        id: true,
        contactHistoryId: true,
        claudeSummary: true,
        recordingStartAt: true,
        scheduledAt: true,
        claudeMinutesAppendedAt: true,
      },
    });
    if (!rec) return { appended: false, alreadyAppended: false };
    const body = rec.claudeSummary?.trim();
    if (!body) return { appended: false, alreadyAppended: false };

    const alreadyAppended = !!rec.claudeMinutesAppendedAt;
    if (alreadyAppended && !params.overwrite) {
      return { appended: false, alreadyAppended: true };
    }

    const separator = buildClaudeMinutesSeparator(
      rec.recordingStartAt ?? rec.scheduledAt
    );

    const ch = await db.hojoContactHistory.findUnique({
      where: { id: rec.contactHistoryId },
      select: { meetingMinutes: true },
    });

    let baseText = ch?.meetingMinutes ?? "";
    if (alreadyAppended) {
      baseText = removeExistingClaudeSection(baseText);
    }

    const chunk = `${separator}\n${body}`;
    const merged =
      baseText.trim().length === 0
        ? chunk
        : `${baseText.trimEnd()}\n\n${chunk}`;

    await db.hojoContactHistory.update({
      where: { id: rec.contactHistoryId },
      data: { meetingMinutes: merged },
    });
    await db.hojoZoomRecording.update({
      where: { id: rec.id },
      data: { claudeMinutesAppendedAt: new Date() },
    });

    return { appended: true, alreadyAppended };
  };

  if (params.tx) {
    return run(params.tx);
  }
  return prisma.$transaction((tx) => run(tx));
}

export async function appendRecordingMinutesHojo(params: {
  recordingId: number;
  tx?: Prisma.TransactionClient;
}): Promise<{ appended: boolean }> {
  const run = async (
    db: Prisma.TransactionClient
  ): Promise<{ appended: boolean }> => {
    const rec = await db.hojoZoomRecording.findUnique({
      where: { id: params.recordingId },
      select: {
        id: true,
        contactHistoryId: true,
        aiCompanionSummary: true,
        summaryNextSteps: true,
        label: true,
        isPrimary: true,
        scheduledAt: true,
        recordingStartAt: true,
        minutesAppendedAt: true,
      },
    });
    if (!rec) return { appended: false };
    if (rec.minutesAppendedAt) return { appended: false };

    const summary = rec.aiCompanionSummary?.trim();
    const nextSteps = rec.summaryNextSteps?.trim();
    if (!summary && !nextSteps) return { appended: false };

    const sections: string[] = [];
    if (summary) sections.push(summary);
    if (nextSteps) sections.push(`【ネクストステップ】\n${nextSteps}`);
    const source = sections.join("\n\n");

    const separator = buildMinutesSeparator({
      label: rec.label,
      isPrimary: rec.isPrimary,
      startedAt: rec.recordingStartAt ?? rec.scheduledAt,
    });

    const ch = await db.hojoContactHistory.findUnique({
      where: { id: rec.contactHistoryId },
      select: { meetingMinutes: true },
    });

    const existing = ch?.meetingMinutes?.trim() ?? "";
    const chunk = `${separator}\n${source}`;
    const merged = existing.length === 0 ? chunk : `${existing}\n\n${chunk}`;

    await db.hojoContactHistory.update({
      where: { id: rec.contactHistoryId },
      data: { meetingMinutes: merged },
    });
    await db.hojoZoomRecording.update({
      where: { id: rec.id },
      data: { minutesAppendedAt: new Date() },
    });

    return { appended: true };
  };

  if (params.tx) {
    return run(params.tx);
  }
  return prisma.$transaction((tx) => run(tx));
}
