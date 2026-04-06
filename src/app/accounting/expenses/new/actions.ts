"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import type { SessionUser } from "@/types/auth";
import { isSystemAdmin, isFounder, hasPermission } from "@/lib/auth/permissions";

// 機密フィルタ: 作成者・承認者・経理権限者のみ閲覧可能
// システム管理者・Founderであっても機密経費は見えない
function buildExpenseConfidentialFilter(user: SessionUser) {
  if (hasPermission(user.permissions, "accounting", "edit")) return {};
  return {
    OR: [
      { isConfidential: false },
      { isConfidential: true, createdBy: user.id },
      { isConfidential: true, approverStaffId: user.id },
    ],
  };
}

// ============================================
// 型定義
// ============================================

export type CounterpartyOption = {
  id: number;
  name: string;
  displayId: string | null;
  companyId: number | null; // null = その他、non-null = Stella顧客
  companyCode: string | null; // MasterStellaCompany.companyCode（SC-XXX形式）
};

export type AllocationTemplateOption = {
  id: number;
  name: string;
  lines: {
    costCenterId: number | null;
    allocationRate: number;
    label: string | null;
    costCenterName: string | null;
  }[];
};

export type CostCenterOption = {
  id: number;
  name: string;
  projectId: number | null;
};

export type ExpenseFormData = {
  counterparties: CounterpartyOption[];
  expenseCategories: { id: number; name: string; type: string; projectId: number }[];
  project: { id: number; code: string; name: string; defaultApproverStaffId: number | null; operatingCompanyId: number | null } | null;
  allProjects: { id: number; code: string; name: string; defaultApproverStaffId: number | null; operatingCompanyId: number | null }[];
  paymentMethods: { id: number; name: string; methodType: string }[];
  operatingCompanies: { id: number; companyName: string }[];
  staffOptions: { id: number; name: string }[];
  approversByProject: Record<number, { id: number; name: string }[]>;
  allocationTemplates: AllocationTemplateOption[];
  costCenters: CostCenterOption[];
  currentUserId: number;
};

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
    allocationTemplatesRaw,
    costCenters,
  ] = await Promise.all([
    prisma.counterparty.findMany({
      where: { deletedAt: null, mergedIntoId: null, isActive: true },
      select: {
        id: true,
        name: true,
        displayId: true,
        companyId: true,
        company: { select: { companyCode: true } },
      },
      orderBy: { id: "desc" },
    }).then((list) =>
      list.map((c) => ({
        id: c.id,
        name: c.name,
        displayId: c.displayId,
        companyId: c.companyId,
        companyCode: c.company?.companyCode ?? null,
      }))
    ),
    prisma.expenseCategory.findMany({
      where: { deletedAt: null, isActive: true },
      select: { id: true, name: true, type: true, projectId: true },
      orderBy: { displayOrder: "asc" },
    }),
    prisma.masterProject.findMany({
      where: { isActive: true },
      select: { id: true, code: true, name: true, defaultApproverStaffId: true, operatingCompanyId: true },
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
    prisma.allocationTemplate.findMany({
      where: { deletedAt: null, isActive: true },
      include: {
        lines: {
          include: { costCenter: { select: { id: true, name: true } } },
        },
      },
      orderBy: { name: "asc" },
    }),
    prisma.costCenter.findMany({
      where: { deletedAt: null, isActive: true },
      select: { id: true, name: true, projectId: true },
      orderBy: { name: "asc" },
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
    allocationTemplates: allocationTemplatesRaw.map((t) => ({
      id: t.id,
      name: t.name,
      lines: t.lines.map((l) => ({
        costCenterId: l.costCenterId,
        allocationRate: Number(l.allocationRate),
        label: l.label,
        costCenterName: l.costCenter?.name ?? null,
      })),
    })),
    costCenters,
    currentUserId: session.id,
  };
}

// ============================================
// submitExpenseRequest
// ============================================

type ExpenseOwnerInput = { staffId?: number | null; customName?: string | null };

export type SubmitExpenseInput = {
  mode: "accounting" | "project";
  projectId: number;
  // 取引先: counterpartyId(マスタ選択) or customCounterpartyName(手入力)
  counterpartyId?: number | null;
  customCounterpartyName?: string | null;
  operatingCompanyId: number;
  expenseCategoryId?: number | null; // プロジェクト側は任意
  paymentMethodId?: number | null;
  approverStaffId?: number | null;
  amountType: "fixed" | "variable";
  amount?: number | null;
  taxRate: number;
  taxAmount?: number | null;
  frequency: "once" | "monthly" | "yearly" | "weekly";
  intervalCount?: number;
  executionDay?: number | null;
  executeOnLastDay?: boolean;
  startDate?: string | null;
  endDate?: string | null;
  scheduledPaymentDate?: string | null;
  note?: string | null;
  expenseOwners: ExpenseOwnerInput[];
  recurringName?: string | null;
  // 按分
  useAllocation?: boolean;
  allocationTemplateId?: number | null;
  costCenterId?: number | null;
  isConfidential?: boolean;
};

export async function submitExpenseRequest(
  input: SubmitExpenseInput
): Promise<{ id: number; type: "transaction" | "recurring" } | { error: string }> {
  try {
    const session = await getSession();
    const staffId = session.id;

    if (!input.projectId) throw new Error("プロジェクトは必須です");
    if (!input.counterpartyId && !input.customCounterpartyName?.trim()) {
      throw new Error("取引先を選択するか、取引先名を入力してください");
    }
    if (!input.operatingCompanyId) throw new Error("支払元法人は必須です");
    if (input.mode === "accounting" && !input.expenseCategoryId) {
      throw new Error("勘定科目（費目）は必須です");
    }
    if (input.mode === "project" && !input.approverStaffId) {
      throw new Error("承認者は必須です");
    }
    if (input.amountType === "fixed") {
      if (input.amount == null || input.amount < 0 || !Number.isInteger(input.amount)) {
        throw new Error("金額は0以上の整数で入力してください");
      }
    }

    // 手入力取引先の場合: counterpartyId=null、customCounterpartyNameのみ保持
    // 経理が承認時にマスタ紐付けまたは新規追加する
    const counterpartyId = input.counterpartyId ?? null;
    const customCounterpartyName = (!counterpartyId && input.customCounterpartyName?.trim()) || null;

    const project = await prisma.masterProject.findUnique({
      where: { id: input.projectId },
      select: { defaultCostCenterId: true },
    });

    if (input.approverStaffId) {
      const perm = await prisma.staffPermission.findFirst({
        where: { staffId: input.approverStaffId, projectId: input.projectId, canApprove: true },
        select: { id: true },
      });
      if (!perm) throw new Error("選択された承認者はこ��プロジェクトの承認権限を持っていません");
    }

    const isAccounting = input.mode === "accounting";
    const initialStatus = isAccounting ? "awaiting_accounting" : "pending_project_approval";

    // === 定期取引 ===
    if (input.frequency !== "once") {
      if (!counterpartyId) throw new Error("定期取引の場合は取引先をマスタから選択してください（手入力不可）");
      if (!input.recurringName?.trim()) throw new Error("定期取引の名称���必須です");
      if (!input.startDate) throw new Error("支払い開始日は必須です");

      const result = await prisma.$transaction(async (tx) => {
        const recurring = await tx.recurringTransaction.create({
          data: {
            type: "expense",
            name: input.recurringName!.trim(),
            counterpartyId,
            expenseCategoryId: input.expenseCategoryId ||
              // 費目なしの場合はプロジェクトのデフォルト費目を探す（なければ必須エラー回避のため例外）
              (await getOrThrowDefaultExpenseCategory(input.projectId)),
            allocationTemplateId: input.useAllocation ? (input.allocationTemplateId ?? null) : null,
            costCenterId: input.useAllocation ? null : (input.costCenterId ?? project?.defaultCostCenterId ?? null),
            paymentMethodId: input.paymentMethodId ?? null,
            projectId: input.projectId,
            approverStaffId: input.approverStaffId ?? null,
            amount: input.amountType === "fixed" ? input.amount! : null,
            taxAmount: input.amountType === "fixed" ? (input.taxAmount ?? 0) : null,
            taxRate: input.taxRate,
            amountType: input.amountType,
            frequency: input.frequency,
            intervalCount: Math.max(1, input.intervalCount || 1),
            executionDay: input.executeOnLastDay ? null : (input.executionDay ?? null),
            executeOnLastDay: input.executeOnLastDay ?? false,
            startDate: new Date(input.startDate!),
            endDate: input.endDate ? new Date(input.endDate) : null,
            isActive: true,
            note: input.note?.trim() || null,
            createdBy: staffId,
          },
        });

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

        // 初回分（固定金額の場合のみ）
        let transactionId: number | null = null;
        if (input.amountType === "fixed" && input.amount != null) {
          const startDate = new Date(input.startDate!);
          const periodFrom = startDate;
          const periodTo = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0);

          const pg = await tx.paymentGroup.create({
            data: {
              counterpartyId,
              operatingCompanyId: input.operatingCompanyId,
              projectId: input.projectId,
              paymentType: "direct",
              status: initialStatus,
              approverStaffId: input.approverStaffId ?? null,
              customCounterpartyName,
              totalAmount: input.amount,
              taxAmount: input.taxAmount ?? 0,
              expectedPaymentDate: startDate,
              isConfidential: input.isConfidential ?? false,
              createdBy: staffId,
            },
          });
          await tx.paymentGroup.update({
            where: { id: pg.id },
            data: { referenceCode: `PG-${pg.id.toString().padStart(4, "0")}` },
          });

          const txn = await tx.transaction.create({
            data: {
              paymentGroupId: pg.id,
              recurringTransactionId: recurring.id,
              counterpartyId,
              expenseCategoryId: input.expenseCategoryId || null,
              allocationTemplateId: input.useAllocation ? (input.allocationTemplateId ?? null) : null,
              costCenterId: input.useAllocation ? null : (input.costCenterId ?? project?.defaultCostCenterId ?? null),
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
              isConfidential: input.isConfidential ?? false,
              hasExpenseOwner: validOwners.length > 0,
              createdBy: staffId,
            },
          });
          transactionId = txn.id;

          if (validOwners.length > 0) {
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
      return { id: result.recurringId, type: "recurring" as const };
    }

    // === 一度限り ===
    if (!input.scheduledPaymentDate) throw new Error("支払予定日は必須です");
    const scheduledPaymentDate = new Date(input.scheduledPaymentDate);
    // 一度限りの場合: periodFrom/periodTo は支払予定日と同じにする
    const periodFrom = scheduledPaymentDate;
    const periodTo = scheduledPaymentDate;

    const isCustom = !counterpartyId;
    const validOwners = input.expenseOwners.filter((o) => o.staffId || o.customName);

    const result = await prisma.$transaction(async (tx) => {
      // PaymentGroup作成（手入力の場合 counterpartyId=null）
      const pg = await tx.paymentGroup.create({
        data: {
          counterpartyId,
          operatingCompanyId: input.operatingCompanyId,
          projectId: input.projectId,
          paymentType: "direct",
          status: initialStatus,
          approverStaffId: input.approverStaffId ?? null,
          customCounterpartyName,
          totalAmount: input.amountType === "fixed" ? input.amount! : null,
          taxAmount: input.amountType === "fixed" ? (input.taxAmount ?? 0) : null,
          expectedPaymentDate: scheduledPaymentDate,
          isConfidential: input.isConfidential ?? false,
          createdBy: staffId,
        },
      });
      await tx.paymentGroup.update({
        where: { id: pg.id },
        data: { referenceCode: `PG-${pg.id.toString().padStart(4, "0")}` },
      });

      // Transaction は取引先が確定している場合のみ作成
      // 手入力の場合は経理が承認時に取引先を確定してからTransaction作成
      let transactionId: number | null = null;
      if (!isCustom) {
        const txn = await tx.transaction.create({
          data: {
            paymentGroupId: pg.id,
            counterpartyId: counterpartyId!,
            expenseCategoryId: input.expenseCategoryId || null,
            allocationTemplateId: input.useAllocation ? (input.allocationTemplateId ?? null) : null,
            costCenterId: input.useAllocation ? null : (input.costCenterId ?? project?.defaultCostCenterId ?? null),
            projectId: input.projectId,
            paymentMethodId: input.paymentMethodId ?? null,
            type: "expense",
            amount: input.amountType === "fixed" ? input.amount! : 0,
            taxAmount: input.amountType === "fixed" ? (input.taxAmount ?? 0) : 0,
            taxRate: input.taxRate,
            taxType: "tax_included",
            periodFrom,
            periodTo,
            scheduledPaymentDate,
            status: initialStatus,
            note: input.note?.trim() || null,
            sourceType: "manual",
            isConfidential: input.isConfidential ?? false,
            hasExpenseOwner: validOwners.length > 0,
            createdBy: staffId,
          },
        });
        transactionId = txn.id;

        if (validOwners.length > 0) {
          await tx.transactionExpenseOwner.createMany({
            data: validOwners.map((o) => ({
              transactionId: txn.id,
              staffId: o.staffId ?? null,
              customName: o.customName ?? null,
            })),
          });
        }
      }

      return { paymentGroupId: pg.id, transactionId };
    });

    revalidatePath("/accounting/workflow");
    return { id: result.paymentGroupId, type: "transaction" as const };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "経費の作成に失敗しました" };
  }
}

/** RecurringTransaction.expenseCategoryId は必須。費目未指定時のフォールバック */
async function getOrThrowDefaultExpenseCategory(projectId: number): Promise<number> {
  const cat = await prisma.expenseCategory.findFirst({
    where: { projectId, deletedAt: null, isActive: true, type: { in: ["expense", "both"] } },
    select: { id: true },
    orderBy: { displayOrder: "asc" },
  });
  if (!cat) throw new Error("このプロジェクトに費目が登録されていません。先に費目マスタを設定してください");
  return cat.id;
}

// ============================================
// タブ用データ取得
// ============================================

export type ExpenseStatusItem = {
  id: number;
  groupType: "payment";
  referenceCode: string | null;
  counterpartyName: string;
  customCounterpartyName: string | null;
  totalAmount: number | null;
  status: string;
  approverName: string | null;
  createdAt: Date;
  createdByName: string;
  // プレビュー用
  note: string | null;
  expenseCategoryName: string | null;
  paymentMethodName: string | null;
  periodFrom: Date | null;
  periodTo: Date | null;
  expenseOwners: string[];
};

/** 申請状況タブ: プロジェクト内の手動経費一覧 */
export async function getMyExpenses(projectId: number): Promise<ExpenseStatusItem[]> {
  const session = await getSession();
  const confidentialFilter = buildExpenseConfidentialFilter(session);
  const pgs = await prisma.paymentGroup.findMany({
    where: {
      deletedAt: null,
      projectId,
      paymentType: "direct",
      status: { in: ["pending_project_approval", "pending_accounting_approval", "awaiting_accounting", "returned", "paid"] },
      ...confidentialFilter,
    },
    select: {
      id: true,
      referenceCode: true,
      totalAmount: true,
      status: true,
      customCounterpartyName: true,
      createdAt: true,
      counterparty: { select: { name: true } },
      approver: { select: { name: true } },
      creator: { select: { name: true } },
      transactions: {
        where: { deletedAt: null },
        take: 1,
        select: {
          note: true,
          periodFrom: true,
          periodTo: true,
          expenseCategory: { select: { name: true } },
          paymentMethod: { select: { name: true } },
          expenseOwners: { select: { staff: { select: { name: true } }, customName: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return pgs.map((pg) => {
    const tx = pg.transactions[0];
    return {
      id: pg.id,
      groupType: "payment" as const,
      referenceCode: pg.referenceCode,
      counterpartyName: pg.counterparty?.name ?? pg.customCounterpartyName ?? "（未設定）",
      customCounterpartyName: pg.customCounterpartyName,
      totalAmount: pg.totalAmount,
      status: pg.status,
      approverName: pg.approver?.name ?? null,
      createdAt: pg.createdAt,
      createdByName: pg.creator.name,
      note: tx?.note ?? null,
      expenseCategoryName: tx?.expenseCategory?.name ?? null,
      paymentMethodName: tx?.paymentMethod?.name ?? null,
      periodFrom: tx?.periodFrom ?? null,
      periodTo: tx?.periodTo ?? null,
      expenseOwners: tx?.expenseOwners.map((o) => o.staff?.name || o.customName || "-") ?? [],
    };
  });
}

/** 承認待ちタブ: 自分が承認者になっている経費 */
export async function getPendingApprovals(projectId: number): Promise<ExpenseStatusItem[]> {
  const session = await getSession();

  const pgs = await prisma.paymentGroup.findMany({
    where: {
      deletedAt: null,
      projectId,
      status: "pending_project_approval",
      approverStaffId: session.id,
    },
    select: {
      id: true,
      referenceCode: true,
      totalAmount: true,
      status: true,
      customCounterpartyName: true,
      createdAt: true,
      counterparty: { select: { name: true } },
      approver: { select: { name: true } },
      creator: { select: { name: true } },
      transactions: {
        where: { deletedAt: null },
        take: 1,
        select: {
          note: true,
          periodFrom: true,
          periodTo: true,
          expenseCategory: { select: { name: true } },
          paymentMethod: { select: { name: true } },
          expenseOwners: { select: { staff: { select: { name: true } }, customName: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return pgs.map((pg) => {
    const tx = pg.transactions[0];
    return {
    id: pg.id,
    groupType: "payment" as const,
    referenceCode: pg.referenceCode,
    counterpartyName: pg.counterparty?.name ?? pg.customCounterpartyName ?? "（未設定）",
    customCounterpartyName: pg.customCounterpartyName,
    totalAmount: pg.totalAmount,
    status: pg.status,
    approverName: pg.approver?.name ?? null,
    createdAt: pg.createdAt,
    createdByName: pg.creator.name,
    note: tx?.note ?? null,
    expenseCategoryName: tx?.expenseCategory?.name ?? null,
    paymentMethodName: tx?.paymentMethod?.name ?? null,
    periodFrom: tx?.periodFrom ?? null,
    periodTo: tx?.periodTo ?? null,
    expenseOwners: tx?.expenseOwners.map((o) => o.staff?.name || o.customName || "-") ?? [],
    };
  });
}

export type RecurringItem = {
  id: number;
  name: string;
  counterpartyName: string;
  amount: number | null;
  amountType: string;
  frequency: string;
  intervalCount: number;
  isActive: boolean;
  startDate: Date;
  endDate: Date | null;
  projectName: string | null;
};

/** 定期取引タブ（プロジェクト指定） */
export async function getProjectRecurringTransactions(projectId: number): Promise<RecurringItem[]> {
  const rts = await prisma.recurringTransaction.findMany({
    where: { deletedAt: null, projectId, type: "expense" },
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
    orderBy: { createdAt: "desc" },
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

/** 全プロジェクト横断の定期取引（経理用） */
export async function getAllRecurringTransactions(): Promise<RecurringItem[]> {
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

export type MonthlySummary = {
  month: string; // YYYY-MM
  totalAmount: number;
  count: number;
  items: {
    id: number;
    counterpartyName: string;
    amount: number;
    status: string;
    note: string | null;
    createdAt: Date;
  }[];
};

/** 月別サマリータブ */
export async function getMonthlyExpenseSummary(projectId: number): Promise<MonthlySummary[]> {
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  sixMonthsAgo.setDate(1);
  sixMonthsAgo.setHours(0, 0, 0, 0);

  const txs = await prisma.transaction.findMany({
    where: {
      deletedAt: null,
      projectId,
      type: "expense",
      sourceType: { in: ["manual", "recurring"] },
      createdAt: { gte: sixMonthsAgo },
    },
    select: {
      id: true,
      amount: true,
      status: true,
      note: true,
      createdAt: true,
      counterparty: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const byMonth = new Map<string, MonthlySummary>();
  for (const tx of txs) {
    const month = `${tx.createdAt.getFullYear()}-${String(tx.createdAt.getMonth() + 1).padStart(2, "0")}`;
    if (!byMonth.has(month)) {
      byMonth.set(month, { month, totalAmount: 0, count: 0, items: [] });
    }
    const m = byMonth.get(month)!;
    m.totalAmount += tx.amount;
    m.count += 1;
    m.items.push({
      id: tx.id,
      counterpartyName: tx.counterparty?.name ?? "-",
      amount: tx.amount,
      status: tx.status,
      note: tx.note,
      createdAt: tx.createdAt,
    });
  }

  return Array.from(byMonth.values()).sort((a, b) => b.month.localeCompare(a.month));
}

// ============================================
// プロジェクト承認アクション（1段階目）
// pending_project_approval → pending_accounting_approval
// ============================================

export async function approveByProjectApprover(groupId: number) {
  const session = await getSession();
  const staffId = session.id;

  const group = await prisma.paymentGroup.findFirst({
    where: { id: groupId, deletedAt: null },
    select: { id: true, status: true, approverStaffId: true },
  });
  if (!group) throw new Error("支払グループが見つかりません");
  if (group.status !== "pending_project_approval") {
    throw new Error("このグループはプロジェクト承認待ちではありません");
  }
  if (group.approverStaffId !== staffId) {
    throw new Error("あなたはこのグループの承認者ではありません");
  }

  await prisma.paymentGroup.update({
    where: { id: groupId },
    data: {
      status: "pending_accounting_approval",
      approvedAt: new Date(),
      updater: { connect: { id: staffId } },
    },
  });

  // 子のTransactionも遷移（存在する場合）
  await prisma.transaction.updateMany({
    where: { paymentGroupId: groupId, deletedAt: null, status: "pending_project_approval" },
    data: { status: "pending_accounting_approval" },
  });

  revalidatePath("/accounting/workflow");
  revalidatePath("/stp/expenses/new");
  revalidatePath("/slp/expenses/new");
  revalidatePath("/hojo/expenses/new");
}

export async function rejectByProjectApprover(groupId: number, reason?: string) {
  const session = await getSession();
  const staffId = session.id;

  const group = await prisma.paymentGroup.findFirst({
    where: { id: groupId, deletedAt: null },
    select: { id: true, status: true, approverStaffId: true },
  });
  if (!group) throw new Error("支払グループが見つかりません");
  if (group.status !== "pending_project_approval") {
    throw new Error("このグループはプロジェクト承認待ちではありません");
  }

  await prisma.paymentGroup.update({
    where: { id: groupId },
    data: { status: "returned", updatedBy: staffId },
  });

  if (reason) {
    await prisma.transactionComment.create({
      data: {
        paymentGroupId: groupId,
        body: reason,
        commentType: "return",
        createdBy: staffId,
      },
    });
  }

  revalidatePath("/stp/expenses/new");
  revalidatePath("/slp/expenses/new");
  revalidatePath("/hojo/expenses/new");
}
