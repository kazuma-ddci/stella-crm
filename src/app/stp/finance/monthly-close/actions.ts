"use server";

import { prisma } from "@/lib/prisma";

// ============================================
// 型定義
// ============================================

export type MonthlyCloseViewRow = {
  month: string; // YYYY-MM
  isClosed: boolean;
  revenue: number;
  expense: number;
  grossProfit: number;
};

export type MonthlyCloseHistoryRow = {
  id: number;
  targetMonth: string;
  action: string;
  reason: string | null;
  performerName: string;
  performedAt: string;
};

// ============================================
// データ取得（閲覧のみ）
// ============================================

export async function getMonthlyCloseView(months: string[]) {
  // MonthlyCloseLog 履歴（全社クローズ: projectId = null）
  const logs = await prisma.monthlyCloseLog.findMany({
    where: { projectId: null },
    include: {
      performer: { select: { name: true } },
    },
    orderBy: { performedAt: "desc" },
  });

  // 各月の最新状態
  const statusMap = new Map<string, boolean>();
  for (const log of logs) {
    const key = log.targetMonth.toISOString().split("T")[0].slice(0, 7);
    if (!statusMap.has(key)) {
      statusMap.set(key, log.action === "close");
    }
  }

  // 履歴一覧
  const history: MonthlyCloseHistoryRow[] = logs.map((log) => ({
    id: log.id,
    targetMonth: log.targetMonth.toISOString().split("T")[0].slice(0, 7),
    action: log.action,
    reason: log.reason,
    performerName: log.performer.name,
    performedAt: log.performedAt.toISOString(),
  }));

  // STP売上・経費レコードからPL集計
  // NOTE: 経理側はJournalEntry（確定済み仕訳）ベース。移行完了後に統一予定
  const [revenueRecords, expenseRecords] = await Promise.all([
    prisma.stpRevenueRecord.findMany({
      where: { deletedAt: null },
      select: {
        targetMonth: true,
        expectedAmount: true,
        taxType: true,
        taxRate: true,
      },
    }),
    prisma.stpExpenseRecord.findMany({
      where: { deletedAt: null },
      select: {
        targetMonth: true,
        expectedAmount: true,
        taxType: true,
        taxRate: true,
      },
    }),
  ]);

  // 税込金額計算（auto-generate.tsのcalcTotalWithTaxと同等）
  const calcTotal = (
    amount: number,
    taxType: string | null,
    taxRate: number | null
  ) => {
    const type = taxType || "tax_included";
    const rate = taxRate ?? 10;
    if (type === "tax_excluded") {
      return Math.round(amount * (1 + rate / 100));
    }
    return amount; // tax_included or non_taxable
  };

  const statuses: MonthlyCloseViewRow[] = months.map((month) => {
    const monthRevenue = revenueRecords
      .filter((r) =>
        r.targetMonth.toISOString().split("T")[0].startsWith(month)
      )
      .reduce(
        (sum, r) => sum + calcTotal(r.expectedAmount, r.taxType, r.taxRate),
        0
      );

    const monthExpense = expenseRecords
      .filter((r) =>
        r.targetMonth.toISOString().split("T")[0].startsWith(month)
      )
      .reduce(
        (sum, r) => sum + calcTotal(r.expectedAmount, r.taxType, r.taxRate),
        0
      );

    return {
      month,
      isClosed: statusMap.get(month) || false,
      revenue: monthRevenue,
      expense: monthExpense,
      grossProfit: monthRevenue - monthExpense,
    };
  });

  return { statuses, history };
}
