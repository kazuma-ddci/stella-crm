/**
 * SLP 接触履歴の議事録テキスト統合ユーティリティ
 *
 * 1つの接触履歴に複数の Zoom Recording が紐付くため、議事録テキストは
 * SlpContactHistory.meetingMinutes に区切り線付きで追記していく。
 *
 * 二重追記防止のため SlpZoomRecording.minutesAppendedAt フラグで判定。
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

/**
 * 区切り線ヘッダーを生成
 *   例: "----- メイン (2026/04/25 14:00〜) -----"
 */
export function buildMinutesSeparator(params: {
  label: string | null | undefined;
  isPrimary: boolean;
  startedAt: Date | null;
}): string {
  const label =
    params.label ?? (params.isPrimary ? "メイン" : "追加Zoom");
  const timestamp = formatJstForSeparator(params.startedAt);
  if (timestamp) {
    return `----- ${label} (${timestamp}〜) -----`;
  }
  return `----- ${label} -----`;
}

/**
 * Claude生成議事録用の区切り線を生成
 *   例: "----- Claude生成議事録 (2026/04/23 10:00〜) -----"
 */
export function buildClaudeMinutesSeparator(startedAt: Date | null): string {
  const timestamp = formatJstForSeparator(startedAt);
  if (timestamp) {
    return `----- Claude生成議事録 (${timestamp}〜) -----`;
  }
  return `----- Claude生成議事録 -----`;
}

/**
 * 既存の meetingMinutes から Claude生成議事録セクションを除去する。
 * 区切り線「----- Claude生成議事録 ...」から、次の区切り線 or 文末までを削除。
 *
 * 注意: 先頭の `\n*` を吸収しないこと（前のセクションとの区切り空行が失われ、
 * 残りの区切り線と連続してしまうため）。
 */
export function removeExistingClaudeSection(existing: string): string {
  // ----- Claude生成議事録 ... -----\n<body> を次の "\n-----" or 文末までマッチ
  // （前後の空行は残りのテキストを連結した後で `\n{3,}` 正規化で整理する）
  const pattern =
    /-----\s*Claude生成議事録[^\n]*-----\n[\s\S]*?(?=\n-----|$)/g;
  return existing.replace(pattern, "").replace(/\n{3,}/g, "\n\n").trim();
}

/**
 * Claude生成議事録を ContactHistory.meetingMinutes に追記する。
 *
 * - 既に追記済みの場合: overwrite=true なら既存セクションを削除して再追記
 * - 本体文は Recording.claudeSummary を使用（スタッフ手動編集済みの値を含む）
 * - 追記日時は recordingStartAt > scheduledAt の順でフォールバック
 *
 * 戻り値: appended=true で成功、false なら claudeSummary が無いか、既に追記済みで overwrite=false
 */
export async function appendClaudeSummaryMinutes(params: {
  recordingId: number;
  overwrite: boolean;
  tx?: Prisma.TransactionClient;
}): Promise<{ appended: boolean; alreadyAppended: boolean }> {
  const run = async (
    db: Prisma.TransactionClient
  ): Promise<{ appended: boolean; alreadyAppended: boolean }> => {
    const rec = await db.slpZoomRecording.findUnique({
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

    const ch = await db.slpContactHistory.findUnique({
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

    await db.slpContactHistory.update({
      where: { id: rec.contactHistoryId },
      data: { meetingMinutes: merged },
    });
    await db.slpZoomRecording.update({
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

/**
 * Recording の議事録テキストを ContactHistory.meetingMinutes に追記する。
 *
 * - Recording.minutesAppendedAt がセット済みならスキップ（二重追記防止）
 * - 元の meetingMinutes が空なら「ヘッダー + 本文」で新規セット
 * - 既にテキストがあれば、末尾に空行を挟んでヘッダー + 本文を追記
 *
 * 呼び出し元:
 *   - fetchAndSaveAiSummary（AI要約取得後）
 *
 * 議事録本体は「Zoom AI Companion 要約 + ネクストステップ」。
 * 文字起こしは議事録欄には入れない（長文すぎて可読性を下げるため。
 * 全文は商談詳細モーダルの「文字起こし」タブで参照できる）。
 * どちらも無ければ何もしない。
 */
export async function appendRecordingMinutes(params: {
  recordingId: number;
  tx?: Prisma.TransactionClient;
}): Promise<{ appended: boolean }> {
  const run = async (
    db: Prisma.TransactionClient
  ): Promise<{ appended: boolean }> => {
    const rec = await db.slpZoomRecording.findUnique({
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

    const ch = await db.slpContactHistory.findUnique({
      where: { id: rec.contactHistoryId },
      select: { meetingMinutes: true },
    });

    const existing = ch?.meetingMinutes?.trim() ?? "";
    const chunk = `${separator}\n${source}`;
    const merged = existing.length === 0 ? chunk : `${existing}\n\n${chunk}`;

    await db.slpContactHistory.update({
      where: { id: rec.contactHistoryId },
      data: { meetingMinutes: merged },
    });
    await db.slpZoomRecording.update({
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
