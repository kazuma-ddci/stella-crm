"use server";

import { prisma } from "@/lib/prisma";

// ============================================
// 型定義
// ============================================

export type CashflowForecastItem = {
  date: string; // YYYY-MM-DD
  type: "incoming" | "outgoing";
  source: "invoice" | "transaction" | "recurring" | "credit_card";
  description: string;
  amount: number;
  paymentMethodId: number | null;
  paymentMethodName: string | null;
};

export type PaymentMethodBalance = {
  id: number;
  name: string;
  methodType: string;
  currentBalance: number;
  balanceAlertThreshold: number | null;
};

export type DailyBalance = {
  date: string; // YYYY-MM-DD
  balances: Record<number, number>; // paymentMethodId → balance
  totalBalance: number;
};

export type CashflowForecastData = {
  paymentMethods: PaymentMethodBalance[];
  forecastItems: CashflowForecastItem[];
  dailyBalances: DailyBalance[];
  alerts: Array<{
    paymentMethodId: number;
    paymentMethodName: string;
    date: string;
    projectedBalance: number;
    threshold: number;
  }>;
};

// ============================================
// ヘルパー
// ============================================

function toDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/** 月の指定日（0=末日、1-31=指定日）の実際の日付を返す */
function getActualDay(year: number, month: number, day: number): Date {
  if (day === 0) {
    // 末日
    return new Date(year, month + 1, 0);
  }
  // 月の最終日を超えない
  const lastDay = new Date(year, month + 1, 0).getDate();
  const actualDay = Math.min(day, lastDay);
  return new Date(year, month, actualDay);
}

// ============================================
// メイン関数
// ============================================

export async function getCashflowForecast(
  forecastDays: number = 90
): Promise<CashflowForecastData> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const forecastEnd = addDays(today, forecastDays);

  // --- 決済手段（残高管理対象）を取得 ---
  const paymentMethods = await prisma.paymentMethod.findMany({
    where: {
      isActive: true,
      deletedAt: null,
      initialBalance: { not: null },
    },
    select: {
      id: true,
      name: true,
      methodType: true,
      initialBalance: true,
      initialBalanceDate: true,
      balanceAlertThreshold: true,
      closingDay: true,
      paymentDay: true,
      settlementAccountId: true,
    },
  });

  // --- 各決済手段の現在残高を計算（initialBalanceDate以降のみ集計） ---
  const pmBalances: PaymentMethodBalance[] = [];
  const currentBalanceMap = new Map<number, number>();

  const pmBalanceResults = await Promise.all(
    paymentMethods.map(async (pm) => {
      const txSums = await prisma.bankTransaction.groupBy({
        by: ["direction"],
        where: {
          paymentMethodId: pm.id,
          deletedAt: null,
          transactionDate: {
            ...(pm.initialBalanceDate ? { gte: pm.initialBalanceDate } : {}),
            lte: today,
          },
        },
        _sum: { amount: true },
      });

      let incoming = 0;
      let outgoing = 0;
      for (const row of txSums) {
        if (row.direction === "incoming") incoming = row._sum.amount ?? 0;
        else if (row.direction === "outgoing") outgoing = row._sum.amount ?? 0;
      }

      return {
        pm,
        currentBalance: (pm.initialBalance ?? 0) + incoming - outgoing,
      };
    })
  );

  for (const { pm, currentBalance } of pmBalanceResults) {
    currentBalanceMap.set(pm.id, currentBalance);
    pmBalances.push({
      id: pm.id,
      name: pm.name,
      methodType: pm.methodType,
      currentBalance,
      balanceAlertThreshold: pm.balanceAlertThreshold,
    });
  }

  // --- 予測項目を収集 ---
  const forecastItems: CashflowForecastItem[] = [];

  // 1. 入金予定: InvoiceGroupの支払期限
  const invoiceGroups = await prisma.invoiceGroup.findMany({
    where: {
      deletedAt: null,
      paymentDueDate: { gte: today, lte: forecastEnd },
      status: { in: ["sent", "awaiting_accounting", "partially_paid"] },
    },
    select: {
      id: true,
      invoiceNumber: true,
      paymentDueDate: true,
      totalAmount: true,
      status: true,
      counterparty: { select: { name: true } },
      bankAccount: {
        select: {
          id: true,
          bankName: true,
          paymentMethodId: true,
        },
      },
    },
  });

  // partially_paid の場合、消込済み金額を取得して残額を計算
  const partiallyPaidIds = invoiceGroups
    .filter((ig) => ig.status === "partially_paid")
    .map((ig) => ig.id);

  const reconciledMap = new Map<number, number>();
  if (partiallyPaidIds.length > 0) {
    const journalEntries = await prisma.journalEntry.findMany({
      where: { invoiceGroupId: { in: partiallyPaidIds } },
      select: {
        invoiceGroupId: true,
        reconciliations: { select: { amount: true } },
      },
    });
    for (const je of journalEntries) {
      if (je.invoiceGroupId) {
        const current = reconciledMap.get(je.invoiceGroupId) ?? 0;
        const jeRecon = je.reconciliations.reduce(
          (sum, r) => sum + r.amount,
          0
        );
        reconciledMap.set(je.invoiceGroupId, current + jeRecon);
      }
    }
  }

  for (const ig of invoiceGroups) {
    if (ig.paymentDueDate && ig.totalAmount) {
      // partially_paid の場合は消込済み金額を差し引いた残額を使用
      const reconciledAmount = reconciledMap.get(ig.id) ?? 0;
      const remainingAmount = ig.totalAmount - reconciledAmount;
      if (remainingAmount <= 0) continue;

      forecastItems.push({
        date: toDateString(ig.paymentDueDate),
        type: "incoming",
        source: "invoice",
        description: `${ig.counterparty.name}${ig.invoiceNumber ? ` (${ig.invoiceNumber})` : ""}`,
        amount: remainingAmount,
        paymentMethodId: ig.bankAccount?.paymentMethodId ?? null,
        paymentMethodName: ig.bankAccount?.bankName ?? null,
      });
    }
  }

  // 2. 出金予定: Transaction の paymentDueDate
  const transactions = await prisma.transaction.findMany({
    where: {
      deletedAt: null,
      type: "expense",
      paymentDueDate: { gte: today, lte: forecastEnd },
      status: { notIn: ["paid", "hidden"] },
    },
    select: {
      id: true,
      amount: true,
      taxAmount: true,
      paymentDueDate: true,
      paymentMethodId: true,
      paymentMethod: { select: { name: true } },
      counterparty: { select: { name: true } },
      expenseCategory: { select: { name: true } },
    },
  });

  for (const tx of transactions) {
    if (tx.paymentDueDate) {
      forecastItems.push({
        date: toDateString(tx.paymentDueDate),
        type: "outgoing",
        source: "transaction",
        description: `${tx.counterparty.name} - ${tx.expenseCategory.name}`,
        amount: tx.amount + tx.taxAmount,
        paymentMethodId: tx.paymentMethodId,
        paymentMethodName: tx.paymentMethod?.name ?? null,
      });
    }
  }

  // 3. 出金予定: 定期取引
  const recurringTransactions = await prisma.recurringTransaction.findMany({
    where: {
      isActive: true,
      deletedAt: null,
      type: "expense",
      amountType: "fixed",
      amount: { not: null },
      startDate: { lte: forecastEnd },
      OR: [{ endDate: null }, { endDate: { gte: today } }],
    },
    select: {
      id: true,
      name: true,
      amount: true,
      taxAmount: true,
      taxRate: true,
      frequency: true,
      executionDay: true,
      startDate: true,
      endDate: true,
      paymentMethodId: true,
      paymentMethod: { select: { name: true } },
      counterparty: { select: { name: true } },
    },
  });

  for (const rt of recurringTransactions) {
    const dates = expandRecurringDates(rt, today, forecastEnd);
    const taxAmount = rt.taxAmount ?? Math.floor((rt.amount! * rt.taxRate) / 100);
    for (const date of dates) {
      forecastItems.push({
        date: toDateString(date),
        type: "outgoing",
        source: "recurring",
        description: `[定期] ${rt.counterparty.name} - ${rt.name}`,
        amount: rt.amount! + taxAmount,
        paymentMethodId: rt.paymentMethodId,
        paymentMethodName: rt.paymentMethod?.name ?? null,
      });
    }
  }

  // 4. 出金予定: クレジットカード引落
  const creditCards = paymentMethods.filter(
    (pm) =>
      pm.methodType === "credit_card" &&
      pm.paymentDay != null &&
      pm.closingDay != null &&
      pm.settlementAccountId != null
  );

  for (const cc of creditCards) {
    // 予測期間内の引落日を計算
    const paymentDates = getPaymentDatesInRange(
      cc.paymentDay!,
      today,
      forecastEnd
    );

    for (const paymentDate of paymentDates) {
      // この引落日に対応する締め期間を算出
      const { from, to } = getClosingPeriod(
        cc.closingDay!,
        cc.paymentDay!,
        paymentDate
      );

      // 締め期間内の利用額を集計
      const usageAgg = await prisma.bankTransaction.aggregate({
        where: {
          paymentMethodId: cc.id,
          direction: "outgoing",
          deletedAt: null,
          transactionDate: { gte: from, lte: to },
        },
        _sum: { amount: true },
      });

      const totalUsage = usageAgg._sum.amount ?? 0;
      if (totalUsage > 0) {
        const settlementPm = paymentMethods.find(
          (pm) => pm.id === cc.settlementAccountId
        );
        forecastItems.push({
          date: toDateString(paymentDate),
          type: "outgoing",
          source: "credit_card",
          description: `[クレカ引落] ${cc.name}`,
          amount: totalUsage,
          paymentMethodId: cc.settlementAccountId,
          paymentMethodName: settlementPm?.name ?? null,
        });
      }
    }
  }

  // --- 日別残高推移を計算 ---
  const dailyBalances: DailyBalance[] = [];
  const alerts: CashflowForecastData["alerts"] = [];

  // 日ごとの入出金を集計
  const dailyDeltaMap = new Map<
    string,
    Map<number, number>
  >();

  for (const item of forecastItems) {
    if (!dailyDeltaMap.has(item.date)) {
      dailyDeltaMap.set(item.date, new Map());
    }
    const dayMap = dailyDeltaMap.get(item.date)!;
    const pmId = item.paymentMethodId;
    if (pmId != null) {
      const current = dayMap.get(pmId) ?? 0;
      const delta = item.type === "incoming" ? item.amount : -item.amount;
      dayMap.set(pmId, current + delta);
    }
  }

  // 各日の残高を積み上げ
  const runningBalance = new Map<number, number>();
  for (const pm of pmBalances) {
    runningBalance.set(pm.id, pm.currentBalance);
  }

  const balancePmIds = pmBalances.map((pm) => pm.id);
  let currentDate = new Date(today);
  while (currentDate <= forecastEnd) {
    const dateStr = toDateString(currentDate);
    const dayDelta = dailyDeltaMap.get(dateStr);

    if (dayDelta) {
      for (const [pmId, delta] of dayDelta) {
        const current = runningBalance.get(pmId) ?? 0;
        runningBalance.set(pmId, current + delta);
      }
    }

    const balances: Record<number, number> = {};
    let totalBalance = 0;
    for (const pmId of balancePmIds) {
      const bal = runningBalance.get(pmId) ?? 0;
      balances[pmId] = bal;
      totalBalance += bal;
    }

    dailyBalances.push({
      date: dateStr,
      balances,
      totalBalance,
    });

    // アラートチェック
    for (const pm of pmBalances) {
      if (pm.balanceAlertThreshold != null) {
        const projected = runningBalance.get(pm.id) ?? 0;
        if (projected < pm.balanceAlertThreshold) {
          // 同じ決済手段の最初のアラートのみ記録
          const existing = alerts.find(
            (a) => a.paymentMethodId === pm.id
          );
          if (!existing) {
            alerts.push({
              paymentMethodId: pm.id,
              paymentMethodName: pm.name,
              date: dateStr,
              projectedBalance: projected,
              threshold: pm.balanceAlertThreshold,
            });
          }
        }
      }
    }

    currentDate = addDays(currentDate, 1);
  }

  // forecastItemsを日付順にソート
  forecastItems.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  return {
    paymentMethods: pmBalances,
    forecastItems,
    dailyBalances,
    alerts,
  };
}

// ============================================
// 定期取引の日付展開
// ============================================

function expandRecurringDates(
  rt: {
    frequency: string;
    executionDay: number | null;
    startDate: Date;
    endDate: Date | null;
  },
  from: Date,
  to: Date
): Date[] {
  const dates: Date[] = [];
  const effectiveStart = rt.startDate > from ? rt.startDate : from;
  const effectiveEnd = rt.endDate && rt.endDate < to ? rt.endDate : to;

  if (effectiveStart > effectiveEnd) return [];

  switch (rt.frequency) {
    case "monthly": {
      let current = new Date(
        effectiveStart.getFullYear(),
        effectiveStart.getMonth(),
        1
      );
      while (current <= effectiveEnd) {
        const day = rt.executionDay ?? 1;
        const execDate = getActualDay(
          current.getFullYear(),
          current.getMonth(),
          day
        );
        if (execDate >= effectiveStart && execDate <= effectiveEnd) {
          dates.push(execDate);
        }
        current = new Date(current.getFullYear(), current.getMonth() + 1, 1);
      }
      break;
    }
    case "yearly": {
      const day = rt.executionDay ?? 1;
      const month = rt.startDate.getMonth();
      for (
        let year = effectiveStart.getFullYear();
        year <= effectiveEnd.getFullYear();
        year++
      ) {
        const execDate = getActualDay(year, month, day);
        if (execDate >= effectiveStart && execDate <= effectiveEnd) {
          dates.push(execDate);
        }
      }
      break;
    }
    case "weekly": {
      const dayOfWeek = rt.executionDay ?? 1; // 0=日, 1=月, ..., 6=土
      let current = new Date(effectiveStart);
      // 最初の該当曜日まで進める
      while (current.getDay() !== dayOfWeek && current <= effectiveEnd) {
        current = addDays(current, 1);
      }
      while (current <= effectiveEnd) {
        dates.push(new Date(current));
        current = addDays(current, 7);
      }
      break;
    }
  }

  return dates;
}

// ============================================
// クレジットカード引落日の計算
// ============================================

function getPaymentDatesInRange(
  paymentDay: number,
  from: Date,
  to: Date
): Date[] {
  const dates: Date[] = [];
  let current = new Date(from.getFullYear(), from.getMonth(), 1);
  const end = new Date(to.getFullYear(), to.getMonth() + 1, 0);

  while (current <= end) {
    const date = getActualDay(
      current.getFullYear(),
      current.getMonth(),
      paymentDay
    );
    if (date >= from && date <= to) {
      dates.push(date);
    }
    current = new Date(current.getFullYear(), current.getMonth() + 1, 1);
  }

  return dates;
}

/** 締め期間を算出: 引落日から逆算して、対応する締め期間のfrom〜toを返す */
function getClosingPeriod(
  closingDay: number,
  _paymentDay: number,
  paymentDate: Date
): { from: Date; to: Date } {
  // 引落月の前月の締め日翌日 〜 引落月の前月の締め日
  // 例: 締め日15日、引落日10日、引落月3月 → 締め期間: 1月16日〜2月15日
  const paymentMonth = paymentDate.getMonth();
  const paymentYear = paymentDate.getFullYear();

  // 締め日のtoを算出（引落月の前月の締め日）
  const closingTo = getActualDay(
    paymentYear,
    paymentMonth - 1,
    closingDay
  );

  // 締め日のfromを算出（closingToの前月の締め日翌日）
  const prevClosing = getActualDay(
    closingTo.getFullYear(),
    closingTo.getMonth() - 1,
    closingDay
  );
  const from = addDays(prevClosing, 1);

  return { from, to: closingTo };
}
