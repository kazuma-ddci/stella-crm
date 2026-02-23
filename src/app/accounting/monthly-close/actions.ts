"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import {
  closeMonth as doCloseMonth,
  reopenMonth as doReopenMonth,
} from "@/lib/finance/monthly-close";

// ============================================
// 型定義
// ============================================

export type MonthlyCloseStatusRow = {
  month: string; // YYYY-MM
  isClosed: boolean;
  revenue: number;
  expense: number;
  grossProfit: number;
};

export type MonthlyCloseLogRow = {
  id: number;
  targetMonth: string; // YYYY-MM
  action: string;
  reason: string | null;
  performerName: string;
  performedAt: string; // ISO string
  hasSnapshot: boolean;
};

// ============================================
// データ取得
// ============================================

export async function getMonthlyCloseData(months: string[]) {
  // MonthlyCloseLog のイベント履歴（全社クローズ: projectId = null）
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
  const history: MonthlyCloseLogRow[] = logs.map((log) => ({
    id: log.id,
    targetMonth: log.targetMonth.toISOString().split("T")[0].slice(0, 7),
    action: log.action,
    reason: log.reason,
    performerName: log.performer.name,
    performedAt: log.performedAt.toISOString(),
    hasSnapshot: log.snapshotData != null,
  }));

  // 月範囲の確定済み仕訳からPL集計
  const monthDates = months.map((m) => {
    const [y, mo] = m.split("-").map(Number);
    return new Date(y, mo - 1, 1);
  });

  const oldestMonth = monthDates[monthDates.length - 1];
  const newestMonthEnd = new Date(
    monthDates[0].getFullYear(),
    monthDates[0].getMonth() + 1,
    0
  );

  const journalEntries = await prisma.journalEntry.findMany({
    where: {
      status: "confirmed",
      deletedAt: null,
      journalDate: {
        gte: oldestMonth,
        lte: newestMonthEnd,
      },
    },
    include: {
      lines: {
        include: {
          account: { select: { category: true } },
        },
      },
    },
  });

  const monthlyPL = new Map<string, { revenue: number; expense: number }>();

  for (const entry of journalEntries) {
    const monthKey = entry.journalDate.toISOString().split("T")[0].slice(0, 7);
    if (!monthlyPL.has(monthKey)) {
      monthlyPL.set(monthKey, { revenue: 0, expense: 0 });
    }
    const pl = monthlyPL.get(monthKey)!;

    for (const line of entry.lines) {
      if (line.account.category === "revenue") {
        pl.revenue += line.side === "credit" ? line.amount : -line.amount;
      } else if (line.account.category === "expense") {
        pl.expense += line.side === "debit" ? line.amount : -line.amount;
      }
    }
  }

  const statuses: MonthlyCloseStatusRow[] = months.map((month) => {
    const pl = monthlyPL.get(month) || { revenue: 0, expense: 0 };
    return {
      month,
      isClosed: statusMap.get(month) || false,
      revenue: pl.revenue,
      expense: pl.expense,
      grossProfit: pl.revenue - pl.expense,
    };
  });

  return { statuses, history };
}

// ============================================
// PLスナップショット生成
// ============================================

async function generatePLSnapshot(targetMonth: Date) {
  const monthStart = new Date(
    targetMonth.getFullYear(),
    targetMonth.getMonth(),
    1
  );
  const monthEnd = new Date(
    targetMonth.getFullYear(),
    targetMonth.getMonth() + 1,
    0
  );

  const journalEntries = await prisma.journalEntry.findMany({
    where: {
      status: "confirmed",
      deletedAt: null,
      journalDate: {
        gte: monthStart,
        lte: monthEnd,
      },
    },
    include: {
      lines: {
        include: {
          account: {
            select: { id: true, code: true, name: true, category: true },
          },
        },
      },
    },
  });

  // 勘定科目別集計
  const accountTotals = new Map<
    number,
    {
      accountId: number;
      accountCode: string;
      accountName: string;
      category: string;
      debitTotal: number;
      creditTotal: number;
      netAmount: number;
    }
  >();

  for (const entry of journalEntries) {
    for (const line of entry.lines) {
      if (!accountTotals.has(line.accountId)) {
        accountTotals.set(line.accountId, {
          accountId: line.accountId,
          accountCode: line.account.code,
          accountName: line.account.name,
          category: line.account.category,
          debitTotal: 0,
          creditTotal: 0,
          netAmount: 0,
        });
      }
      const total = accountTotals.get(line.accountId)!;
      if (line.side === "debit") {
        total.debitTotal += line.amount;
      } else {
        total.creditTotal += line.amount;
      }
    }
  }

  // 純額計算
  for (const [, total] of accountTotals) {
    if (total.category === "revenue" || total.category === "liability") {
      total.netAmount = total.creditTotal - total.debitTotal;
    } else {
      total.netAmount = total.debitTotal - total.creditTotal;
    }
  }

  const accounts = Array.from(accountTotals.values());
  const totalRevenue = accounts
    .filter((a) => a.category === "revenue")
    .reduce((sum, a) => sum + a.netAmount, 0);
  const totalExpense = accounts
    .filter((a) => a.category === "expense")
    .reduce((sum, a) => sum + a.netAmount, 0);

  return {
    targetMonth: monthStart.toISOString(),
    generatedAt: new Date().toISOString(),
    summary: {
      totalRevenue,
      totalExpense,
      grossProfit: totalRevenue - totalExpense,
    },
    accounts,
    journalEntryCount: journalEntries.length,
  };
}

// ============================================
// クローズ・再オープン操作
// ============================================

export async function closeMonthAction(targetMonth: string) {
  const session = await getSession();
  const staffId = session.id;

  const monthDate = new Date(targetMonth);

  // PLスナップショット生成
  const snapshot = await generatePLSnapshot(monthDate);

  await doCloseMonth(monthDate, staffId, snapshot);

  revalidatePath("/accounting/monthly-close");
  revalidatePath("/stp/finance/monthly-close");
}

export async function reopenMonthAction(
  targetMonth: string,
  reason: string
) {
  const session = await getSession();
  const staffId = session.id;

  await doReopenMonth(new Date(targetMonth), staffId, reason);

  revalidatePath("/accounting/monthly-close");
  revalidatePath("/stp/finance/monthly-close");
}
