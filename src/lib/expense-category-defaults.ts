import { prisma } from "@/lib/prisma";

export const STP_SYSTEM_CATEGORIES = [
  { systemCode: "stp_revenue_initial", name: "初期費用（売上）", type: "revenue" },
  { systemCode: "stp_revenue_monthly", name: "月額費用（売上）", type: "revenue" },
  { systemCode: "stp_revenue_performance", name: "成果報酬（売上）", type: "revenue" },
  { systemCode: "stp_expense_agent", name: "代理店費用", type: "expense" },
  { systemCode: "stp_expense_commission", name: "紹介報酬", type: "expense" },
] as const;

/**
 * STPシステム費目が不足していれば自動作成する
 * @param projectId STPプロジェクトのID
 */
export async function ensureSystemExpenseCategories(projectId: number): Promise<void> {
  const existing = await prisma.expenseCategory.findMany({
    where: {
      systemCode: { not: null },
      deletedAt: null,
    },
    select: { systemCode: true },
  });

  const existingCodes = new Set(existing.map((e) => e.systemCode));
  const missing = STP_SYSTEM_CATEGORIES.filter(
    (c) => !existingCodes.has(c.systemCode)
  );

  if (missing.length === 0) return;

  await prisma.expenseCategory.createMany({
    data: missing.map((c, i) => ({
      name: c.name,
      type: c.type,
      systemCode: c.systemCode,
      projectId,
      displayOrder: 100 + i, // 既存のユーザー費目の後に配置
      isActive: true,
    })),
  });
}
