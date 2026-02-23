"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

// ============================================
// 型定義
// ============================================

export type BudgetFormData = {
  costCenters: {
    id: number;
    name: string;
    projectId: number | null;
  }[];
  accounts: {
    id: number;
    code: string;
    name: string;
    category: string;
  }[];
};

export type BudgetRow = {
  id: number;
  costCenterId: number | null;
  accountId: number | null;
  categoryLabel: string;
  targetMonth: Date;
  budgetAmount: number;
  memo: string | null;
  costCenter: { id: number; name: string } | null;
  account: { id: number; code: string; name: string; category: string } | null;
};

export type BudgetVsActualRow = {
  categoryLabel: string;
  accountId: number | null;
  accountCode: string | null;
  accountName: string | null;
  accountCategory: string | null;
  costCenterId: number | null;
  costCenterName: string | null;
  budgetAmount: number;
  actualAmount: number;
  difference: number; // budget - actual (正=余裕, 負=超過)
  achievementRate: number | null; // actual / budget * 100 (予算0の場合null)
};

// ============================================
// データ取得
// ============================================

export async function getBudgetFormData(): Promise<BudgetFormData> {
  const [costCenters, accounts] = await Promise.all([
    prisma.costCenter.findMany({
      where: { isActive: true, deletedAt: null },
      select: { id: true, name: true, projectId: true },
      orderBy: { name: "asc" },
    }),
    prisma.account.findMany({
      where: { isActive: true },
      select: { id: true, code: true, name: true, category: true },
      orderBy: [{ displayOrder: "asc" }, { code: "asc" }],
    }),
  ]);

  return { costCenters, accounts };
}

export async function getBudgets(
  fiscalYear: number,
  costCenterId?: number | null
): Promise<BudgetRow[]> {
  const startDate = new Date(fiscalYear, 0, 1); // 1月1日
  const endDate = new Date(fiscalYear + 1, 0, 1); // 翌年1月1日

  const where: Record<string, unknown> = {
    targetMonth: {
      gte: startDate,
      lt: endDate,
    },
  };

  if (costCenterId !== undefined) {
    where.costCenterId = costCenterId;
  }

  const budgets = await prisma.budget.findMany({
    where,
    include: {
      costCenter: { select: { id: true, name: true } },
      account: { select: { id: true, code: true, name: true, category: true } },
    },
    orderBy: [
      { costCenterId: "asc" },
      { categoryLabel: "asc" },
      { targetMonth: "asc" },
    ],
  });

  return budgets;
}

// ============================================
// バリデーション
// ============================================

function validateBudgetData(data: Record<string, unknown>) {
  // categoryLabel
  const categoryLabel = (data.categoryLabel as string)?.trim();
  if (!categoryLabel) {
    throw new Error("カテゴリラベルは必須です");
  }

  // targetMonth
  if (!data.targetMonth) {
    throw new Error("対象月は必須です");
  }
  const targetMonth = new Date(data.targetMonth as string);
  if (isNaN(targetMonth.getTime())) {
    throw new Error("対象月が無効な日付です");
  }
  // 月初日に正規化
  targetMonth.setDate(1);
  targetMonth.setHours(0, 0, 0, 0);

  // budgetAmount
  const budgetAmount = Number(data.budgetAmount);
  if (data.budgetAmount === undefined || data.budgetAmount === null || isNaN(budgetAmount) || !Number.isInteger(budgetAmount)) {
    throw new Error("予算額は整数で入力してください");
  }

  // costCenterId
  const costCenterId = data.costCenterId ? Number(data.costCenterId) : null;
  if (costCenterId !== null && isNaN(costCenterId)) {
    throw new Error("コストセンターIDが不正です");
  }

  // accountId
  const accountId = data.accountId ? Number(data.accountId) : null;
  if (accountId !== null && isNaN(accountId)) {
    throw new Error("勘定科目IDが不正です");
  }

  // memo
  const memo = data.memo ? (data.memo as string).trim() : null;

  return { categoryLabel, targetMonth, budgetAmount, costCenterId, accountId, memo };
}

// ============================================
// CRUD操作
// ============================================

export async function createBudget(data: Record<string, unknown>) {
  const session = await getSession();
  const staffId = session.id;

  const { categoryLabel, targetMonth, budgetAmount, costCenterId, accountId, memo } =
    validateBudgetData(data);

  // コストセンター存在チェック
  if (costCenterId) {
    const cc = await prisma.costCenter.findFirst({
      where: { id: costCenterId, deletedAt: null },
      select: { id: true },
    });
    if (!cc) {
      throw new Error("指定されたコストセンターが見つかりません");
    }
  }

  // 勘定科目存在チェック
  if (accountId) {
    const account = await prisma.account.findUnique({
      where: { id: accountId },
      select: { id: true },
    });
    if (!account) {
      throw new Error("指定された勘定科目が見つかりません");
    }
  }

  // 重複チェック（同じコストセンター×カテゴリ×月）
  const existing = await prisma.budget.findFirst({
    where: {
      costCenterId: costCenterId,
      categoryLabel,
      targetMonth,
    },
    select: { id: true },
  });
  if (existing) {
    throw new Error(
      `同じコストセンター・カテゴリ・月の予算が既に存在します（ID: ${existing.id}）`
    );
  }

  await prisma.budget.create({
    data: {
      costCenterId,
      accountId,
      categoryLabel,
      targetMonth,
      budgetAmount,
      memo,
      createdBy: staffId,
    },
  });

  revalidatePath("/accounting/budget");
}

export async function updateBudget(id: number, data: Record<string, unknown>) {
  const session = await getSession();
  const staffId = session.id;

  const existing = await prisma.budget.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!existing) {
    throw new Error("予算が見つかりません");
  }

  const updateData: Record<string, unknown> = {};

  if ("categoryLabel" in data) {
    const categoryLabel = (data.categoryLabel as string)?.trim();
    if (!categoryLabel) throw new Error("カテゴリラベルは必須です");
    updateData.categoryLabel = categoryLabel;
  }

  if ("budgetAmount" in data) {
    const budgetAmount = Number(data.budgetAmount);
    if (isNaN(budgetAmount) || !Number.isInteger(budgetAmount)) {
      throw new Error("予算額は整数で入力してください");
    }
    updateData.budgetAmount = budgetAmount;
  }

  if ("accountId" in data) {
    const accountId = data.accountId ? Number(data.accountId) : null;
    if (accountId) {
      const account = await prisma.account.findUnique({
        where: { id: accountId },
        select: { id: true },
      });
      if (!account) throw new Error("指定された勘定科目が見つかりません");
    }
    updateData.accountId = accountId;
  }

  if ("memo" in data) {
    updateData.memo = data.memo ? (data.memo as string).trim() : null;
  }

  updateData.updatedBy = staffId;

  await prisma.budget.update({
    where: { id },
    data: updateData,
  });

  revalidatePath("/accounting/budget");
}

export async function deleteBudget(id: number) {
  const session = await getSession();
  void session; // 認証確認のみ

  const existing = await prisma.budget.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!existing) {
    throw new Error("予算が見つかりません");
  }

  await prisma.budget.delete({
    where: { id },
  });

  revalidatePath("/accounting/budget");
}

// ============================================
// 月コピー機能
// ============================================

export async function copyBudgetMonth(
  sourceCostCenterId: number | null,
  sourceYear: number,
  sourceMonth: number, // 0-indexed (0=1月)
  targetYear: number,
  targetMonth: number // 0-indexed
) {
  const session = await getSession();
  const staffId = session.id;

  const sourceDate = new Date(sourceYear, sourceMonth, 1);
  const targetDate = new Date(targetYear, targetMonth, 1);

  // コピー元の予算取得
  const sourceBudgets = await prisma.budget.findMany({
    where: {
      costCenterId: sourceCostCenterId,
      targetMonth: sourceDate,
    },
  });

  if (sourceBudgets.length === 0) {
    throw new Error("コピー元の月に予算データがありません");
  }

  // コピー先に既存データがあるかチェック
  const existingTarget = await prisma.budget.findMany({
    where: {
      costCenterId: sourceCostCenterId,
      targetMonth: targetDate,
    },
    select: { id: true, categoryLabel: true },
  });

  const existingLabels = new Set(existingTarget.map((b) => b.categoryLabel));

  // 既存でないものだけコピー
  const toCreate = sourceBudgets.filter(
    (b) => !existingLabels.has(b.categoryLabel)
  );

  if (toCreate.length === 0) {
    throw new Error("コピー先の月にはすべてのカテゴリが既に存在します");
  }

  await prisma.budget.createMany({
    data: toCreate.map((b) => ({
      costCenterId: b.costCenterId,
      accountId: b.accountId,
      categoryLabel: b.categoryLabel,
      targetMonth: targetDate,
      budgetAmount: b.budgetAmount,
      memo: b.memo,
      createdBy: staffId,
    })),
  });

  revalidatePath("/accounting/budget");

  return { copied: toCreate.length, skipped: existingLabels.size };
}

// ============================================
// 定期取引から下書き生成
// ============================================

// 定期取引からの自動生成プレビュー用の型
export type RecurringBudgetPreviewItem = {
  categoryLabel: string;
  costCenterName: string | null;
  targetMonth: string; // ISO文字列
  budgetAmount: number;
  recurringName: string;
  status: "create" | "skip";
};

/**
 * 定期取引から予算を自動生成する前のプレビューを返す
 * 差分レビュー表示用
 */
export async function previewBudgetFromRecurring(
  fiscalYear: number,
  costCenterId: number | null
): Promise<RecurringBudgetPreviewItem[]> {
  await getSession();

  const recurring = await prisma.recurringTransaction.findMany({
    where: {
      isActive: true,
      deletedAt: null,
      amountType: "fixed",
      amount: { not: null },
      ...(costCenterId !== null ? { costCenterId } : {}),
    },
    include: {
      expenseCategory: {
        select: { id: true, name: true, defaultAccountId: true },
      },
      costCenter: { select: { id: true, name: true } },
    },
  });

  if (recurring.length === 0) {
    throw new Error("対象となる定期取引（固定金額・アクティブ）がありません");
  }

  const preview: RecurringBudgetPreviewItem[] = [];

  for (const rt of recurring) {
    const months = expandRecurringToMonths(rt, fiscalYear);

    for (const month of months) {
      const targetMonth = new Date(fiscalYear, month, 1);
      const categoryLabel = rt.expenseCategory.name;
      const rtCostCenterId = rt.costCenterId;

      const existing = await prisma.budget.findFirst({
        where: {
          costCenterId: rtCostCenterId,
          categoryLabel,
          targetMonth,
        },
        select: { id: true },
      });

      preview.push({
        categoryLabel,
        costCenterName: rt.costCenter?.name ?? null,
        targetMonth: targetMonth.toISOString(),
        budgetAmount: rt.amount!,
        recurringName: rt.name,
        status: existing ? "skip" : "create",
      });
    }
  }

  return preview;
}

export async function generateBudgetFromRecurring(
  fiscalYear: number,
  costCenterId: number | null
) {
  const session = await getSession();
  const staffId = session.id;

  // アクティブな固定金額の定期取引を取得
  const recurring = await prisma.recurringTransaction.findMany({
    where: {
      isActive: true,
      deletedAt: null,
      amountType: "fixed",
      amount: { not: null },
      ...(costCenterId !== null ? { costCenterId } : {}),
    },
    include: {
      expenseCategory: {
        select: { id: true, name: true, defaultAccountId: true },
      },
      costCenter: { select: { id: true, name: true } },
    },
  });

  if (recurring.length === 0) {
    throw new Error("対象となる定期取引（固定金額・アクティブ）がありません");
  }

  let created = 0;
  let skipped = 0;

  for (const rt of recurring) {
    // 月ごとに展開
    const months = expandRecurringToMonths(rt, fiscalYear);

    for (const month of months) {
      const targetMonth = new Date(fiscalYear, month, 1);
      const categoryLabel = rt.expenseCategory.name;
      const rtCostCenterId = rt.costCenterId;

      // 既存チェック
      const existing = await prisma.budget.findFirst({
        where: {
          costCenterId: rtCostCenterId,
          categoryLabel,
          targetMonth,
        },
        select: { id: true },
      });

      if (existing) {
        skipped++;
        continue;
      }

      await prisma.budget.create({
        data: {
          costCenterId: rtCostCenterId,
          accountId: rt.expenseCategory.defaultAccountId,
          categoryLabel,
          targetMonth,
          budgetAmount: rt.amount!,
          memo: `定期取引「${rt.name}」より自動生成`,
          createdBy: staffId,
        },
      });
      created++;
    }
  }

  revalidatePath("/accounting/budget");

  return { created, skipped };
}

/**
 * 定期取引を指定年度の月に展開する
 * @returns 月番号の配列（0-indexed: 0=1月, 11=12月）
 */
function expandRecurringToMonths(
  rt: {
    frequency: string;
    executionDay: number | null;
    startDate: Date;
    endDate: Date | null;
  },
  fiscalYear: number
): number[] {
  const months: number[] = [];
  const yearStart = new Date(fiscalYear, 0, 1);
  const yearEnd = new Date(fiscalYear, 11, 31);

  const effectiveStart = rt.startDate > yearStart ? rt.startDate : yearStart;
  const effectiveEnd = rt.endDate && rt.endDate < yearEnd ? rt.endDate : yearEnd;

  if (effectiveStart > effectiveEnd) return [];

  switch (rt.frequency) {
    case "monthly":
      // 毎月発生
      for (let m = effectiveStart.getMonth(); m <= effectiveEnd.getMonth(); m++) {
        // startDateとendDateの年をチェック
        const monthDate = new Date(fiscalYear, m, 1);
        if (monthDate >= new Date(effectiveStart.getFullYear(), effectiveStart.getMonth(), 1) &&
            monthDate <= new Date(effectiveEnd.getFullYear(), effectiveEnd.getMonth(), 1)) {
          months.push(m);
        }
      }
      break;

    case "yearly":
      // 年1回（executionDay は月日として扱う — ここでは開始日の月に発生）
      {
        const execMonth = rt.startDate.getMonth();
        const monthDate = new Date(fiscalYear, execMonth, 1);
        if (monthDate >= new Date(effectiveStart.getFullYear(), effectiveStart.getMonth(), 1) &&
            monthDate <= new Date(effectiveEnd.getFullYear(), effectiveEnd.getMonth(), 1)) {
          months.push(execMonth);
        }
      }
      break;

    case "weekly":
      // 週次 → 月ごとに約4回発生。各月に発生するものとして扱う
      for (let m = effectiveStart.getMonth(); m <= effectiveEnd.getMonth(); m++) {
        const monthDate = new Date(fiscalYear, m, 1);
        if (monthDate >= new Date(effectiveStart.getFullYear(), effectiveStart.getMonth(), 1) &&
            monthDate <= new Date(effectiveEnd.getFullYear(), effectiveEnd.getMonth(), 1)) {
          months.push(m);
        }
      }
      break;
  }

  return months;
}

// ============================================
// 予実比較
// ============================================

export async function getBudgetVsActual(
  fiscalYear: number,
  month?: number, // 0-indexed。undefinedなら年度全体
  costCenterId?: number | null
): Promise<BudgetVsActualRow[]> {
  // 期間計算
  let startDate: Date;
  let endDate: Date;

  if (month !== undefined) {
    startDate = new Date(fiscalYear, month, 1);
    endDate = new Date(fiscalYear, month + 1, 1);
  } else {
    startDate = new Date(fiscalYear, 0, 1);
    endDate = new Date(fiscalYear + 1, 0, 1);
  }

  // 予算取得
  const budgetWhere: Record<string, unknown> = {
    targetMonth: {
      gte: startDate,
      lt: endDate,
    },
  };
  if (costCenterId !== undefined) {
    budgetWhere.costCenterId = costCenterId;
  }

  const budgets = await prisma.budget.findMany({
    where: budgetWhere,
    include: {
      account: { select: { id: true, code: true, name: true, category: true } },
      costCenter: { select: { id: true, name: true } },
    },
  });

  // 仕訳実績取得（確定済みのみ）
  const journalEntries = await prisma.journalEntry.findMany({
    where: {
      status: "confirmed",
      deletedAt: null,
      journalDate: {
        gte: startDate,
        lt: endDate,
      },
    },
    include: {
      lines: {
        include: {
          account: { select: { id: true, code: true, name: true, category: true } },
        },
      },
    },
  });

  // 勘定科目別に実績集計（借方-貸方で純額）
  // expense/asset の勘定科目: 借方が増加（正）、貸方が減少（負）
  // revenue/liability の勘定科目: 貸方が増加（正）、借方が減少（負）
  const actualByAccount = new Map<number, number>();
  // 勘定科目名別の実績集計（accountId=nullの予算とcategoryLabelでマッチングするため）
  const actualByAccountName = new Map<string, number>();

  for (const entry of journalEntries) {
    for (const line of entry.lines) {
      const current = actualByAccount.get(line.accountId) || 0;
      const category = line.account.category;

      let amount: number;
      if (category === "expense" || category === "asset") {
        // 借方が正
        amount = line.side === "debit" ? line.amount : -line.amount;
      } else {
        // revenue/liability: 貸方が正
        amount = line.side === "credit" ? line.amount : -line.amount;
      }
      actualByAccount.set(line.accountId, current + amount);

      // 勘定科目名別にも集計
      const accountName = line.account.name;
      const currentByName = actualByAccountName.get(accountName) || 0;
      actualByAccountName.set(accountName, currentByName + amount);
    }
  }

  // 予算をカテゴリ別に集計
  const budgetMap = new Map<
    string,
    {
      categoryLabel: string;
      accountId: number | null;
      accountCode: string | null;
      accountName: string | null;
      accountCategory: string | null;
      costCenterId: number | null;
      costCenterName: string | null;
      budgetAmount: number;
    }
  >();

  for (const b of budgets) {
    const key = `${b.costCenterId ?? "all"}:${b.accountId ?? "none"}:${b.categoryLabel}`;
    const existing = budgetMap.get(key);
    if (existing) {
      existing.budgetAmount += b.budgetAmount;
    } else {
      budgetMap.set(key, {
        categoryLabel: b.categoryLabel,
        accountId: b.accountId,
        accountCode: b.account?.code ?? null,
        accountName: b.account?.name ?? null,
        accountCategory: b.account?.category ?? null,
        costCenterId: b.costCenterId,
        costCenterName: b.costCenter?.name ?? null,
        budgetAmount: b.budgetAmount,
      });
    }
  }

  // 結果を組み立て
  const results: BudgetVsActualRow[] = [];

  for (const [, budget] of budgetMap) {
    // accountIdがある場合はIDで直接マッチ、ない場合はcategoryLabelで勘定科目名マッチ
    const actualAmount = budget.accountId
      ? actualByAccount.get(budget.accountId) || 0
      : actualByAccountName.get(budget.categoryLabel) || 0;

    const difference = budget.budgetAmount - actualAmount;
    const achievementRate =
      budget.budgetAmount !== 0
        ? Math.round((actualAmount / budget.budgetAmount) * 10000) / 100
        : null;

    results.push({
      ...budget,
      actualAmount,
      difference,
      achievementRate,
    });
  }

  // カテゴリラベルでソート
  results.sort((a, b) => {
    if (a.costCenterName !== b.costCenterName) {
      return (a.costCenterName ?? "").localeCompare(b.costCenterName ?? "", "en");
    }
    return a.categoryLabel.localeCompare(b.categoryLabel, "en");
  });

  return results;
}
