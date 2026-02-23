"use server";

import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

/**
 * 指定月がクローズされているか判定（MonthlyCloseLog ベース）
 * 全社クローズ（projectId = null）の最新アクションを確認
 */
export async function isMonthClosed(targetMonth: Date): Promise<boolean> {
  const monthStart = new Date(
    targetMonth.getFullYear(),
    targetMonth.getMonth(),
    1
  );
  const latestLog = await prisma.monthlyCloseLog.findFirst({
    where: {
      projectId: null,
      targetMonth: monthStart,
    },
    orderBy: { performedAt: "desc" },
    select: { action: true },
  });
  return latestLog?.action === "close";
}

/**
 * 月次クローズ実行（MonthlyCloseLog にイベント記録）
 */
export async function closeMonth(
  targetMonth: Date,
  performedBy: number,
  snapshotData?: Prisma.InputJsonValue
): Promise<void> {
  const monthStart = new Date(
    targetMonth.getFullYear(),
    targetMonth.getMonth(),
    1
  );

  const alreadyClosed = await isMonthClosed(monthStart);
  if (alreadyClosed) {
    throw new Error(
      `${monthStart.getFullYear()}年${monthStart.getMonth() + 1}月は既にクローズ済みです`
    );
  }

  await prisma.monthlyCloseLog.create({
    data: {
      projectId: null,
      targetMonth: monthStart,
      action: "close",
      snapshotData: snapshotData ?? undefined,
      performedBy,
    },
  });
}

/**
 * 月次再オープン（MonthlyCloseLog にイベント記録）
 */
export async function reopenMonth(
  targetMonth: Date,
  performedBy: number,
  reason: string
): Promise<void> {
  const monthStart = new Date(
    targetMonth.getFullYear(),
    targetMonth.getMonth(),
    1
  );

  const closed = await isMonthClosed(monthStart);
  if (!closed) {
    throw new Error(
      `${monthStart.getFullYear()}年${monthStart.getMonth() + 1}月はクローズされていません`
    );
  }

  if (!reason.trim()) {
    throw new Error("再オープンの理由は必須です");
  }

  await prisma.monthlyCloseLog.create({
    data: {
      projectId: null,
      targetMonth: monthStart,
      action: "reopen",
      reason: reason.trim(),
      performedBy,
    },
  });
}

/**
 * 月次クローズチェック（Server Action用ガード）
 * 対象月がクローズされていればエラーをthrow
 */
export async function ensureMonthNotClosed(targetMonth: Date): Promise<void> {
  const closed = await isMonthClosed(targetMonth);
  if (closed) {
    throw new Error(
      `${targetMonth.getFullYear()}年${targetMonth.getMonth() + 1}月は月次クローズ済みのため変更できません`
    );
  }
}
