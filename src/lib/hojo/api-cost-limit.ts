// API費用日次上限のチェック/解除ヘルパー。
// 事業計画書（Claude API）のみが課金対象。研修終了報告書・支援制度申請書は無料レンダリング。

import { prisma } from "@/lib/prisma";

/** 日次上限（円） */
export const DAILY_API_COST_LIMIT_YEN = 5000;

/** USD→JPY 概算レート（料金表示用。厳密な為替ではなく固定値）。 */
export const USD_TO_YEN_RATE = 150;

/**
 * JST の本日0時（UTC表現）を返す。DB の date 型は「日付のみ」なので比較用。
 * 例: 2026-04-21 09:00 JST → 2026-04-21T00:00:00.000Z を返す（DB側で UTC DATE として保存）
 */
function todayJstDateUtc(): Date {
  const now = new Date();
  const jstMs = now.getTime() + 9 * 60 * 60 * 1000; // UTC + 9h
  const jstDate = new Date(jstMs);
  return new Date(Date.UTC(jstDate.getUTCFullYear(), jstDate.getUTCMonth(), jstDate.getUTCDate()));
}

/** 本日の API 費用合計（円）と上限状況を返す。 */
export async function checkDailyApiCostLimit(): Promise<{
  allowed: boolean;
  dailyUsageYen: number;
  dailyUsageUsd: number;
  limitYen: number;
  overridden: boolean;
  overriddenAt: Date | null;
  overriddenByName: string | null;
}> {
  const today = todayJstDateUtc();

  // 本日 JST 内（UTC換算で 前日15時 ～ 当日15時）に生成された書類の costUsd を合計
  const jstStart = new Date(today.getTime() - 9 * 60 * 60 * 1000); // UTC 前日15時
  const jstEnd = new Date(jstStart.getTime() + 24 * 60 * 60 * 1000); // UTC 当日15時

  const docs = await prisma.hojoApplicationSupportDocument.findMany({
    where: { generatedAt: { gte: jstStart, lt: jstEnd } },
    select: { costUsd: true },
  });
  const totalUsd = docs.reduce((sum, d) => sum + (d.costUsd ? Number(d.costUsd) : 0), 0);
  const totalYen = Math.ceil(totalUsd * USD_TO_YEN_RATE);

  const override = await prisma.hojoDailyApiCostOverride.findUnique({
    where: { date: today },
    include: { overriddenByStaff: { select: { name: true } } },
  });

  const overridden = !!override;
  const allowed = totalYen < DAILY_API_COST_LIMIT_YEN || overridden;

  return {
    allowed,
    dailyUsageYen: totalYen,
    dailyUsageUsd: totalUsd,
    limitYen: DAILY_API_COST_LIMIT_YEN,
    overridden,
    overriddenAt: override?.overriddenAt ?? null,
    overriddenByName: override?.overriddenByStaff?.name ?? null,
  };
}

/** 本日の上限を解除する。同日 upsert なので冪等。 */
export async function enableDailyApiCostOverride(staffId: number | null, reason?: string) {
  const today = todayJstDateUtc();
  await prisma.hojoDailyApiCostOverride.upsert({
    where: { date: today },
    update: { overriddenAt: new Date(), overriddenByStaffId: staffId, reason: reason ?? null },
    create: { date: today, overriddenByStaffId: staffId, reason: reason ?? null },
  });
}

/** 本日の解除を取り消す。 */
export async function disableDailyApiCostOverride() {
  const today = todayJstDateUtc();
  await prisma.hojoDailyApiCostOverride.deleteMany({ where: { date: today } });
}
