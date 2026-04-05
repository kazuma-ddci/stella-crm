"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

// ============================================
// 型定義
// ============================================

export type ExpenseFormData = {
  counterparties: { id: number; name: string; displayId: string | null }[];
  expenseCategories: { id: number; name: string; type: string; projectId: number }[];
  project: { id: number; code: string; name: string; defaultApproverStaffId: number | null } | null;
  allProjects: { id: number; code: string; name: string; defaultApproverStaffId: number | null }[];
  paymentMethods: { id: number; name: string; methodType: string }[];
  operatingCompanies: { id: number; companyName: string }[];
  staffOptions: { id: number; name: string }[];
  approversByProject: Record<number, { id: number; name: string }[]>;
  currentUserId: number;
};

/**
 * 経費申請フォームのデータ取得
 * @param projectCode プロジェクトコード（null = 経理モード、プロジェクト選択を表示）
 */
export async function getExpenseFormData(
  projectCode: string | null
): Promise<ExpenseFormData> {
  const session = await getSession();

  const [
    counterparties,
    expenseCategories,
    projects,
    paymentMethods,
    operatingCompanies,
    staffOptions,
    permissions,
  ] = await Promise.all([
    prisma.counterparty.findMany({
      where: { deletedAt: null, mergedIntoId: null, isActive: true },
      select: { id: true, name: true, displayId: true },
      orderBy: { name: "asc" },
    }),
    prisma.expenseCategory.findMany({
      where: { deletedAt: null, isActive: true, type: { in: ["expense", "both"] } },
      select: { id: true, name: true, type: true, projectId: true },
      orderBy: { displayOrder: "asc" },
    }),
    prisma.masterProject.findMany({
      where: { isActive: true },
      select: { id: true, code: true, name: true, defaultApproverStaffId: true },
      orderBy: { displayOrder: "asc" },
    }),
    prisma.paymentMethod.findMany({
      where: { deletedAt: null, isActive: true },
      select: { id: true, name: true, methodType: true },
      orderBy: { name: "asc" },
    }),
    prisma.operatingCompany.findMany({
      where: { isActive: true },
      select: { id: true, companyName: true },
      orderBy: { id: "asc" },
    }),
    prisma.masterStaff.findMany({
      where: { isActive: true, isSystemUser: false },
      select: { id: true, name: true },
      orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
    }),
    prisma.staffPermission.findMany({
      where: { canApprove: true },
      select: {
        projectId: true,
        staff: { select: { id: true, name: true, isActive: true, isSystemUser: true } },
      },
    }),
  ]);

  const approversByProject: Record<number, { id: number; name: string }[]> = {};
  for (const p of permissions) {
    if (!p.staff.isActive || p.staff.isSystemUser) continue;
    if (!approversByProject[p.projectId]) approversByProject[p.projectId] = [];
    approversByProject[p.projectId].push({ id: p.staff.id, name: p.staff.name });
  }

  const project = projectCode
    ? projects.find((p) => p.code === projectCode) ?? null
    : null;

  return {
    counterparties,
    expenseCategories,
    project,
    allProjects: projects,
    paymentMethods,
    operatingCompanies,
    staffOptions,
    approversByProject,
    currentUserId: session.id,
  };
}

// ============================================
// submitExpenseRequest
// ============================================

type ExpenseOwnerInput = { staffId?: number | null; customName?: string | null };

export type SubmitExpenseInput = {
  // 経理モードかプロジェクト申請モードか
  mode: "accounting" | "project";

  projectId: number;
  counterpartyId: number;
  operatingCompanyId: number;
  expenseCategoryId: number;
  paymentMethodId?: number | null;

  // 承認者（プロジェクトモードでは必須、経理モードでは任意）
  approverStaffId?: number | null;

  // 金額
  amountType: "fixed" | "variable";
  amount?: number | null;  // 固定の場合
  taxRate: number;
  taxAmount?: number | null;

  // 支払いサイクル
  frequency: "once" | "monthly" | "yearly" | "weekly";
  intervalCount?: number;    // monthly/yearly の場合の繰り返し間隔
  executionDay?: number | null;
  executeOnLastDay?: boolean;
  startDate?: string | null; // 定期の場合の開始日
  endDate?: string | null;   // 定期の場合の終了日（空=無期限）

  // 一度限りの場合の発生期間
  periodFrom?: string | null;
  periodTo?: string | null;
  paymentDueDate?: string | null;

  note?: string | null;
  expenseOwners: ExpenseOwnerInput[];

  // 定期取引の名称（定期の場合必須）
  recurringName?: string | null;
};

export async function submitExpenseRequest(
  input: SubmitExpenseInput
): Promise<{ id: number; type: "transaction" | "recurring" } | { error: string }> {
  try {
    const session = await getSession();
    const staffId = session.id;

    // === 共通バリデーション ===
    if (!input.projectId) throw new Error("プロジェクトは必須です");
    if (!input.counterpartyId) throw new Error("取引先は必須です");
    if (!input.operatingCompanyId) throw new Error("支払元法人は必須です");
    if (!input.expenseCategoryId) throw new Error("勘定科目（費目）は必須です");

    if (input.mode === "project" && !input.approverStaffId) {
      throw new Error("承認者は必須です");
    }

    if (input.amountType === "fixed") {
      if (input.amount == null || input.amount < 0 || !Number.isInteger(input.amount)) {
        throw new Error("金額は0以上の整数で入力してください");
      }
    }

    // CostCenter取得
    const project = await prisma.masterProject.findUnique({
      where: { id: input.projectId },
      select: { defaultCostCenterId: true },
    });

    // 承認者チェック（指定されている場合のみ）
    if (input.approverStaffId) {
      const approverPermission = await prisma.staffPermission.findFirst({
        where: {
          staffId: input.approverStaffId,
          projectId: input.projectId,
          canApprove: true,
        },
        select: { id: true },
      });
      if (!approverPermission) {
        throw new Error("選択された承認者はこのプロジェクトの承認権限を持っていません");
      }
    }

    const isAccounting = input.mode === "accounting";
    const initialStatus = isAccounting ? "awaiting_accounting" : "pending_approval";
    const pgStatus = isAccounting ? "awaiting_accounting" : "pending_approval";

    // === 定期取引の場合 ===
    if (input.frequency !== "once") {
      if (!input.recurringName?.trim()) {
        throw new Error("定期取引の名称は必須です");
      }
      if (!input.startDate) {
        throw new Error("支払い開始日は必須です");
      }

      const intervalCount = Math.max(1, input.intervalCount || 1);

      const result = await prisma.$transaction(async (tx) => {
        // 1. RecurringTransaction 作成
        const recurring = await tx.recurringTransaction.create({
          data: {
            type: "expense",
            name: input.recurringName!.trim(),
            counterpartyId: input.counterpartyId,
            expenseCategoryId: input.expenseCategoryId,
            costCenterId: project?.defaultCostCenterId ?? null,
            paymentMethodId: input.paymentMethodId ?? null,
            projectId: input.projectId,
            approverStaffId: input.approverStaffId ?? null,
            amount: input.amountType === "fixed" ? input.amount! : null,
            taxAmount: input.amountType === "fixed" ? (input.taxAmount ?? 0) : null,
            taxRate: input.taxRate,
            amountType: input.amountType,
            frequency: input.frequency,
            intervalCount,
            executionDay: input.executeOnLastDay ? null : (input.executionDay ?? null),
            executeOnLastDay: input.executeOnLastDay ?? false,
            startDate: new Date(input.startDate!),
            endDate: input.endDate ? new Date(input.endDate) : null,
            isActive: true,
            note: input.note?.trim() || null,
            createdBy: staffId,
          },
        });

        // 2. 担当者（RecurringTransactionExpenseOwner）
        const validOwners = input.expenseOwners.filter((o) => o.staffId || o.customName);
        if (validOwners.length > 0) {
          await tx.recurringTransactionExpenseOwner.createMany({
            data: validOwners.map((o) => ({
              recurringTransactionId: recurring.id,
              staffId: o.staffId ?? null,
              customName: o.customName ?? null,
            })),
          });
        }

        // 3. 初回分のPaymentGroup + Transaction を作成（固定金額の場合のみ）
        let transactionId: number | null = null;
        if (input.amountType === "fixed" && input.amount != null) {
          const startDate = new Date(input.startDate!);
          const periodFrom = startDate;
          const periodTo = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0);

          const pg = await tx.paymentGroup.create({
            data: {
              counterpartyId: input.counterpartyId,
              operatingCompanyId: input.operatingCompanyId,
              projectId: input.projectId,
              paymentType: "direct",
              status: pgStatus,
              approverStaffId: input.approverStaffId ?? null,
              totalAmount: input.amount,
              taxAmount: input.taxAmount ?? 0,
              createdBy: staffId,
            },
          });
          await tx.paymentGroup.update({
            where: { id: pg.id },
            data: { referenceCode: `PG-${pg.id.toString().padStart(4, "0")}` },
          });

          const hasOwner = validOwners.length > 0;
          const txn = await tx.transaction.create({
            data: {
              paymentGroupId: pg.id,
              recurringTransactionId: recurring.id,
              counterpartyId: input.counterpartyId,
              expenseCategoryId: input.expenseCategoryId,
              costCenterId: project?.defaultCostCenterId ?? null,
              projectId: input.projectId,
              paymentMethodId: input.paymentMethodId ?? null,
              type: "expense",
              amount: input.amount!,
              taxAmount: input.taxAmount ?? 0,
              taxRate: input.taxRate,
              taxType: "tax_included",
              periodFrom,
              periodTo,
              status: initialStatus,
              note: input.recurringName!.trim() + (input.note ? ` - ${input.note.trim()}` : ""),
              sourceType: "recurring",
              hasExpenseOwner: hasOwner,
              createdBy: staffId,
            },
          });
          transactionId = txn.id;

          if (hasOwner) {
            await tx.transactionExpenseOwner.createMany({
              data: validOwners.map((o) => ({
                transactionId: txn.id,
                staffId: o.staffId ?? null,
                customName: o.customName ?? null,
              })),
            });
          }
        }

        return { recurringId: recurring.id, transactionId };
      });

      revalidatePath("/accounting/workflow");
      revalidatePath("/accounting/masters/recurring-transactions");
      return { id: result.recurringId, type: "recurring" as const };
    }

    // === 一度限りの場合 ===
    if (!input.periodFrom || !input.periodTo) throw new Error("発生期間は必須です");

    const periodFrom = new Date(input.periodFrom);
    const periodTo = new Date(input.periodTo);
    if (periodFrom > periodTo) {
      throw new Error("発生期間の開始日は終了日以前にしてください");
    }

    if (input.amountType === "fixed" && (input.amount == null || input.amount < 0)) {
      throw new Error("金額を正しく入力してください");
    }

    const result = await prisma.$transaction(async (tx) => {
      const pg = await tx.paymentGroup.create({
        data: {
          counterpartyId: input.counterpartyId,
          operatingCompanyId: input.operatingCompanyId,
          projectId: input.projectId,
          paymentType: "direct",
          status: pgStatus,
          approverStaffId: input.approverStaffId ?? null,
          totalAmount: input.amountType === "fixed" ? input.amount! : null,
          taxAmount: input.amountType === "fixed" ? (input.taxAmount ?? 0) : null,
          createdBy: staffId,
        },
      });
      await tx.paymentGroup.update({
        where: { id: pg.id },
        data: { referenceCode: `PG-${pg.id.toString().padStart(4, "0")}` },
      });

      const validOwners = input.expenseOwners.filter((o) => o.staffId || o.customName);
      const hasOwner = validOwners.length > 0;
      const txn = await tx.transaction.create({
        data: {
          paymentGroupId: pg.id,
          counterpartyId: input.counterpartyId,
          expenseCategoryId: input.expenseCategoryId,
          costCenterId: project?.defaultCostCenterId ?? null,
          projectId: input.projectId,
          paymentMethodId: input.paymentMethodId ?? null,
          type: "expense",
          amount: input.amountType === "fixed" ? input.amount! : 0,
          taxAmount: input.amountType === "fixed" ? (input.taxAmount ?? 0) : 0,
          taxRate: input.taxRate,
          taxType: "tax_included",
          periodFrom,
          periodTo,
          paymentDueDate: input.paymentDueDate ? new Date(input.paymentDueDate) : null,
          status: initialStatus,
          note: input.note?.trim() || null,
          sourceType: "manual",
          hasExpenseOwner: hasOwner,
          createdBy: staffId,
        },
      });

      if (hasOwner) {
        await tx.transactionExpenseOwner.createMany({
          data: validOwners.map((o) => ({
            transactionId: txn.id,
            staffId: o.staffId ?? null,
            customName: o.customName ?? null,
          })),
        });
      }

      return { transactionId: txn.id };
    });

    revalidatePath("/accounting/workflow");
    return { id: result.transactionId, type: "transaction" as const };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "経費の作成に失敗しました" };
  }
}
