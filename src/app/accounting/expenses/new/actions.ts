"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

// ============================================
// 型定義
// ============================================

export type ManualExpenseFormData = {
  counterparties: { id: number; name: string; displayId: string | null }[];
  expenseCategories: { id: number; name: string; type: string; projectId: number }[];
  projects: {
    id: number;
    code: string;
    name: string;
    defaultApproverStaffId: number | null;
  }[];
  paymentMethods: { id: number; name: string; methodType: string }[];
  operatingCompanies: { id: number; companyName: string }[];
  staffOptions: { id: number; name: string }[]; // 担当者用
  // プロジェクトIDごとの承認者候補（canApprove=true）
  approversByProject: Record<number, { id: number; name: string }[]>;
  currentUserId: number;
};

export async function getManualExpenseFormData(): Promise<ManualExpenseFormData> {
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

  // プロジェクトごとの承認者候補構築
  const approversByProject: Record<number, { id: number; name: string }[]> = {};
  for (const p of permissions) {
    if (!p.staff.isActive || p.staff.isSystemUser) continue;
    if (!approversByProject[p.projectId]) approversByProject[p.projectId] = [];
    approversByProject[p.projectId].push({ id: p.staff.id, name: p.staff.name });
  }

  return {
    counterparties,
    expenseCategories,
    projects,
    paymentMethods,
    operatingCompanies,
    staffOptions,
    approversByProject,
    currentUserId: session.id,
  };
}

// ============================================
// createManualExpense
// 手動経費を作成（PaymentGroup + Transaction の1:1作成、status='pending_approval'）
// ============================================

type ExpenseOwnerInput = { staffId?: number | null; customName?: string | null };

type CreateManualExpenseInput = {
  projectId: number;
  counterpartyId: number;
  operatingCompanyId: number;
  expenseCategoryId: number;
  paymentMethodId?: number | null;
  approverStaffId: number;
  amount: number; // 税込
  taxRate: number;
  taxAmount: number;
  periodFrom: string; // YYYY-MM-DD
  periodTo: string;
  paymentDueDate?: string | null;
  note?: string | null;
  expenseOwners: ExpenseOwnerInput[];
};

export async function createManualExpense(
  input: CreateManualExpenseInput
): Promise<{ id: number } | { error: string }> {
  try {
    const session = await getSession();
    const staffId = session.id;

    // バリデーション
    if (!input.projectId) throw new Error("プロジェクトは必須です");
    if (!input.counterpartyId) throw new Error("取引先は必須です");
    if (!input.operatingCompanyId) throw new Error("支払元法人は必須です");
    if (!input.expenseCategoryId) throw new Error("勘定科目（費目）は必須です");
    if (!input.approverStaffId) throw new Error("承認者は必須です");
    if (input.amount == null || input.amount < 0 || !Number.isInteger(input.amount)) {
      throw new Error("金額は0以上の整数で入力してください");
    }
    if (!input.periodFrom || !input.periodTo) throw new Error("発生期間は必須です");

    const periodFrom = new Date(input.periodFrom);
    const periodTo = new Date(input.periodTo);
    if (periodFrom > periodTo) {
      throw new Error("発生期間の開始日は終了日以前にしてください");
    }

    // CostCenter（按分なしの場合のプロジェクト紐付け用）を取得
    const project = await prisma.masterProject.findUnique({
      where: { id: input.projectId },
      select: { defaultCostCenterId: true },
    });

    // 承認者の権限チェック（指定されたプロジェクトで canApprove=true であること）
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

    const result = await prisma.$transaction(async (tx) => {
      // 1. PaymentGroup 作成（1:1）— status='pending_approval'
      const paymentGroup = await tx.paymentGroup.create({
        data: {
          counterpartyId: input.counterpartyId,
          operatingCompanyId: input.operatingCompanyId,
          projectId: input.projectId,
          paymentType: "direct",
          status: "pending_approval",
          approverStaffId: input.approverStaffId,
          totalAmount: input.amount,
          taxAmount: input.taxAmount,
          createdBy: staffId,
        },
      });

      // referenceCode 自動採番
      const refCode = `PG-${paymentGroup.id.toString().padStart(4, "0")}`;
      await tx.paymentGroup.update({
        where: { id: paymentGroup.id },
        data: { referenceCode: refCode },
      });

      // 2. Transaction 作成（pending_approval）
      const hasExpenseOwner = input.expenseOwners.length > 0;
      const transaction = await tx.transaction.create({
        data: {
          paymentGroupId: paymentGroup.id,
          counterpartyId: input.counterpartyId,
          expenseCategoryId: input.expenseCategoryId,
          costCenterId: project?.defaultCostCenterId ?? null,
          projectId: input.projectId,
          paymentMethodId: input.paymentMethodId ?? null,
          type: "expense",
          amount: input.amount,
          taxAmount: input.taxAmount,
          taxRate: input.taxRate,
          taxType: "tax_included",
          periodFrom,
          periodTo,
          paymentDueDate: input.paymentDueDate ? new Date(input.paymentDueDate) : null,
          status: "pending_approval",
          note: input.note || null,
          sourceType: "manual",
          hasExpenseOwner,
          createdBy: staffId,
        },
      });

      // 3. 担当者（複数）
      if (hasExpenseOwner) {
        await tx.transactionExpenseOwner.createMany({
          data: input.expenseOwners
            .filter((o) => o.staffId || o.customName)
            .map((o) => ({
              transactionId: transaction.id,
              staffId: o.staffId ?? null,
              customName: o.customName ?? null,
            })),
        });
      }

      return { transaction, paymentGroup };
    });

    revalidatePath("/accounting/workflow");
    revalidatePath("/accounting/expenses/new");

    return { id: result.transaction.id };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "経費の作成に失敗しました" };
  }
}
