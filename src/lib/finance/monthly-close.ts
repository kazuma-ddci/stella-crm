"use server";

import { prisma } from "@/lib/prisma";

// 指定月がロックされているか判定
export async function isMonthClosed(targetMonth: Date): Promise<boolean> {
  const monthStart = new Date(
    targetMonth.getFullYear(),
    targetMonth.getMonth(),
    1
  );
  const record = await prisma.stpMonthlyClose.findUnique({
    where: { targetMonth: monthStart },
  });
  if (!record) return false;
  // reopenedAt が設定されていれば再オープン済み = ロックされていない
  return record.reopenedAt === null;
}

// 月次締め実行
export async function closeMonth(
  targetMonth: Date,
  closedBy: number
): Promise<void> {
  const monthStart = new Date(
    targetMonth.getFullYear(),
    targetMonth.getMonth(),
    1
  );
  await prisma.stpMonthlyClose.upsert({
    where: { targetMonth: monthStart },
    create: { targetMonth: monthStart, closedBy, closedAt: new Date() },
    update: {
      closedAt: new Date(),
      closedBy,
      reopenedAt: null,
      reopenedBy: null,
      reopenReason: null,
    },
  });
}

// 月次再オープン
export async function reopenMonth(
  targetMonth: Date,
  reopenedBy: number,
  reason: string
): Promise<void> {
  const monthStart = new Date(
    targetMonth.getFullYear(),
    targetMonth.getMonth(),
    1
  );
  await prisma.stpMonthlyClose.update({
    where: { targetMonth: monthStart },
    data: { reopenedAt: new Date(), reopenedBy, reopenReason: reason },
  });
}

// 月次締めチェック（Server Action用ヘルパー）
// 対象月がロックされていればエラーをthrow
export async function ensureMonthNotClosed(targetMonth: Date): Promise<void> {
  const closed = await isMonthClosed(targetMonth);
  if (closed) {
    throw new Error(
      `${targetMonth.getFullYear()}年${targetMonth.getMonth() + 1}月は月次締め済みのため変更できません`
    );
  }
}
