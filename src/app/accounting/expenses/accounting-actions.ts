"use server";

/**
 * 経理専用 Expense Server Actions。
 *
 * 全プロジェクト横断の定期取引一覧（経理ダッシュボード等で使用）。
 * プロジェクト個別のものは src/app/finance/expenses/actions.ts を参照。
 */

import { prisma } from "@/lib/prisma";
import { requireStaffForAccounting } from "@/lib/auth/staff-action";
import type { RecurringItem } from "@/app/finance/expenses/actions";

/** 全プロジェクト横断の定期取引（経理用） */
export async function getAllRecurringTransactions(): Promise<RecurringItem[]> {
  await requireStaffForAccounting("view");
  const rts = await prisma.recurringTransaction.findMany({
    where: { deletedAt: null, type: "expense" },
    select: {
      id: true,
      name: true,
      amount: true,
      amountType: true,
      frequency: true,
      intervalCount: true,
      isActive: true,
      startDate: true,
      endDate: true,
      counterparty: { select: { name: true } },
      project: { select: { name: true } },
    },
    orderBy: [{ projectId: "asc" }, { createdAt: "desc" }],
  });

  return rts.map((rt) => ({
    id: rt.id,
    name: rt.name,
    counterpartyName: rt.counterparty.name,
    amount: rt.amount,
    amountType: rt.amountType,
    frequency: rt.frequency,
    intervalCount: rt.intervalCount,
    isActive: rt.isActive,
    startDate: rt.startDate,
    endDate: rt.endDate,
    projectName: rt.project?.name ?? null,
  }));
}
