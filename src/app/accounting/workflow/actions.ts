"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

// ============================================
// 型定義
// ============================================

export type WorkflowCategory =
  | "pending_approval" // 経理承認待ち（手動追加の経費で経理がまだ承認していない）
  | "needs_journal"    // 仕訳待ち
  | "in_progress"      // 処理中（実現待ち and/or 入出金確認待ち）
  | "completed"        // 完了
  | "returned";        // 差し戻し中

export type WorkflowGroup = {
  id: number;
  groupType: "invoice" | "payment";
  label: string;
  counterpartyName: string;
  totalAmount: number | null;
  status: string;
  createdAt: Date;
  category: WorkflowCategory;
  projectId: number | null;
  // 進捗
  transactionCount: number;
  journalizedCount: number;       // 仕訳済みの取引数
  allRealizedCount: number;       // 全仕訳が実現済みの取引数
  // 条件フラグ
  isAllJournalized: boolean;      // 全取引に仕訳あり
  isAllRealized: boolean;         // 全仕訳が実現済み
  hasActualPaymentDate: boolean;  // 入金日/支払日が記録済み
  // TODO: 消込は将来的に追加
};

export type WorkflowTransaction = {
  id: number;
  type: string;
  amount: number;
  taxAmount: number;
  taxType: string;
  counterpartyName: string;
  expenseCategoryName: string;
  projectId: number | null;
  periodFrom: Date;
  periodTo: Date;
  note: string | null;
  status: string;
  journalCompleted: boolean;
  journalEntries: {
    id: number;
    journalDate: Date;
    description: string;
    realizationStatus: string;
    debitTotal: number;
    status: string;
    invoiceGroupId: number | null;
    paymentGroupId: number | null;
    transactionId: number | null;
    bankTransactionId: number | null;
    projectId: number | null;
    counterpartyId: number | null;
    hasInvoice: boolean;
    lines: {
      id: number;
      side: string;
      accountId: number;
      accountName: string;
      amount: number;
      description: string | null;
      taxClassification: string | null;
      taxAmount: number | null;
    }[];
  }[];
};

export type WorkflowGroupDetail = {
  id: number;
  groupType: "invoice" | "payment";
  label: string;
  counterpartyName: string;
  counterpartyId: number | null;
  totalAmount: number | null;
  status: string;
  actualPaymentDate: Date | null;
  category: WorkflowCategory;
  isAllJournalized: boolean;
  isAllRealized: boolean;
  hasActualPaymentDate: boolean;
  transactions: WorkflowTransaction[];
};

// ============================================
// カテゴリ判定ロジック
// ============================================

function determineCategory(
  status: string,
  transactionCount: number,
  journalizedCount: number,
  allRealizedCount: number,
  hasActualPaymentDate: boolean
): WorkflowCategory {
  // 経理承認待ち（手動追加された経費）
  if (status === "pending_approval") return "pending_approval";

  // 差し戻し中
  if (status === "returned") return "returned";

  // 完了済み
  if (status === "paid") return "completed";

  // 仕訳待ち: まだ仕訳が作成されていない取引がある
  if (transactionCount > 0 && journalizedCount < transactionCount) {
    return "needs_journal";
  }

  // 全仕訳済み: 実現 or 入出金のいずれかが未完了 → 処理中
  const isAllRealized = transactionCount > 0 && allRealizedCount === transactionCount;
  if (!isAllRealized || !hasActualPaymentDate) {
    return "in_progress";
  }

  // 全完了
  return "completed";
}

// ============================================
// 1. getWorkflowGroups（経理ワークフロー：グループ一覧）
// ============================================

export async function getWorkflowGroups(): Promise<WorkflowGroup[]> {
  const [invoiceGroups, paymentGroups] = await Promise.all([
    prisma.invoiceGroup.findMany({
      where: {
        deletedAt: null,
        status: { in: ["awaiting_accounting", "partially_paid", "paid", "returned"] },
      },
      select: {
        id: true,
        invoiceNumber: true,
        totalAmount: true,
        status: true,
        createdAt: true,
        actualPaymentDate: true,
        projectId: true,
        counterparty: { select: { name: true } },
        transactions: {
          where: { deletedAt: null },
          select: {
            id: true,
            status: true,
            journalCompleted: true,
            journalEntries: {
              where: { deletedAt: null, status: "confirmed" },
              select: { id: true, realizationStatus: true },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    }),

    prisma.paymentGroup.findMany({
      where: {
        deletedAt: null,
        status: { in: ["pending_approval", "awaiting_accounting", "paid", "returned"] },
      },
      select: {
        id: true,
        referenceCode: true,
        totalAmount: true,
        status: true,
        createdAt: true,
        actualPaymentDate: true,
        projectId: true,
        customCounterpartyName: true,
        counterparty: { select: { name: true } },
        transactions: {
          where: { deletedAt: null },
          select: {
            id: true,
            status: true,
            journalCompleted: true,
            journalEntries: {
              where: { deletedAt: null, status: "confirmed" },
              select: { id: true, realizationStatus: true },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const groups: WorkflowGroup[] = [];

  for (const ig of invoiceGroups) {
    const txCount = ig.transactions.length;
    const journalizedCount = ig.transactions.filter(
      (t) => t.journalCompleted
    ).length;
    const allRealizedCount = ig.transactions.filter(
      (t) =>
        t.journalEntries.length > 0 &&
        t.journalEntries.every((je) => je.realizationStatus === "realized")
    ).length;
    const hasActualPaymentDate = !!ig.actualPaymentDate;
    const isAllJournalized = txCount > 0 && journalizedCount === txCount;
    const isAllRealized = txCount > 0 && allRealizedCount === txCount;

    const category = determineCategory(
      ig.status, txCount, journalizedCount, allRealizedCount, hasActualPaymentDate
    );

    groups.push({
      id: ig.id,
      groupType: "invoice",
      label: ig.invoiceNumber ?? `INV-${ig.id}`,
      counterpartyName: ig.counterparty.name,
      totalAmount: ig.totalAmount,
      status: ig.status,
      createdAt: ig.createdAt,
      category,
      projectId: ig.projectId ?? null,
      transactionCount: txCount,
      journalizedCount,
      allRealizedCount,
      isAllJournalized,
      isAllRealized,
      hasActualPaymentDate,
    });
  }

  for (const pg of paymentGroups) {
    const txCount = pg.transactions.length;
    const journalizedCount = pg.transactions.filter(
      (t) => t.journalCompleted
    ).length;
    const allRealizedCount = pg.transactions.filter(
      (t) =>
        t.journalEntries.length > 0 &&
        t.journalEntries.every((je) => je.realizationStatus === "realized")
    ).length;
    const hasActualPaymentDate = !!pg.actualPaymentDate;
    const isAllJournalized = txCount > 0 && journalizedCount === txCount;
    const isAllRealized = txCount > 0 && allRealizedCount === txCount;

    const category = determineCategory(
      pg.status, txCount, journalizedCount, allRealizedCount, hasActualPaymentDate
    );

    groups.push({
      id: pg.id,
      groupType: "payment",
      label: pg.referenceCode ?? `PG-${pg.id}`,
      counterpartyName: pg.counterparty?.name ?? pg.customCounterpartyName ?? "（未設定）",
      totalAmount: pg.totalAmount,
      status: pg.status,
      createdAt: pg.createdAt,
      category,
      projectId: pg.projectId ?? null,
      transactionCount: txCount,
      journalizedCount,
      allRealizedCount,
      isAllJournalized,
      isAllRealized,
      hasActualPaymentDate,
    });
  }

  // 作成日降順
  groups.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  return groups;
}

// ============================================
// 2. getWorkflowGroupDetail（グループ詳細 — 取引＋仕訳状況）
// ============================================

export async function getWorkflowGroupDetail(
  groupType: "invoice" | "payment",
  groupId: number
): Promise<WorkflowGroupDetail | null> {
  const transactionSelect = {
    id: true,
    type: true,
    amount: true,
    taxAmount: true,
    taxType: true,
    projectId: true,
    periodFrom: true,
    periodTo: true,
    note: true,
    status: true,
    journalCompleted: true,
    counterparty: { select: { name: true } },
    expenseCategory: { select: { name: true } },
    journalEntries: {
      where: { deletedAt: null },
      select: {
        id: true,
        journalDate: true,
        description: true,
        realizationStatus: true,
        status: true,
        invoiceGroupId: true,
        paymentGroupId: true,
        transactionId: true,
        bankTransactionId: true,
        projectId: true,
        counterpartyId: true,
        hasInvoice: true,
        lines: {
          select: {
            id: true,
            side: true,
            amount: true,
            description: true,
            taxClassification: true,
            taxAmount: true,
            account: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { journalDate: "asc" as const },
    },
  };

  const mapTransaction = (t: {
    id: number;
    type: string;
    amount: number;
    taxAmount: number;
    taxType: string;
    projectId: number | null;
    periodFrom: Date;
    periodTo: Date;
    note: string | null;
    status: string;
    journalCompleted: boolean;
    counterparty: { name: string } | null;
    expenseCategory: { name: string } | null;
    journalEntries: {
      id: number;
      journalDate: Date;
      description: string;
      realizationStatus: string;
      status: string;
      invoiceGroupId: number | null;
      paymentGroupId: number | null;
      transactionId: number | null;
      bankTransactionId: number | null;
      projectId: number | null;
      counterpartyId: number | null;
      hasInvoice: boolean;
      lines: { id: number; side: string; amount: number; description: string | null; taxClassification: string | null; taxAmount: number | null; account: { id: number; name: string } }[];
    }[];
  }): WorkflowTransaction => ({
    id: t.id,
    type: t.type,
    amount: t.amount,
    taxAmount: t.taxAmount,
    taxType: t.taxType,
    counterpartyName: t.counterparty?.name ?? "-",
    expenseCategoryName: t.expenseCategory?.name ?? "-",
    projectId: t.projectId,
    periodFrom: t.periodFrom,
    periodTo: t.periodTo,
    note: t.note,
    status: t.status,
    journalCompleted: t.journalCompleted,
    journalEntries: t.journalEntries.map((je) => ({
      id: je.id,
      journalDate: je.journalDate,
      description: je.description,
      realizationStatus: je.realizationStatus,
      status: je.status,
      invoiceGroupId: je.invoiceGroupId,
      paymentGroupId: je.paymentGroupId,
      transactionId: je.transactionId,
      bankTransactionId: je.bankTransactionId,
      projectId: je.projectId,
      counterpartyId: je.counterpartyId,
      hasInvoice: je.hasInvoice,
      debitTotal: je.lines
        .filter((l) => l.side === "debit")
        .reduce((sum, l) => sum + l.amount, 0),
      lines: je.lines.map((l) => ({
        id: l.id,
        side: l.side,
        accountId: l.account.id,
        accountName: l.account.name,
        amount: l.amount,
        description: l.description,
        taxClassification: l.taxClassification,
        taxAmount: l.taxAmount,
      })),
    })),
  });

  if (groupType === "invoice") {
    const group = await prisma.invoiceGroup.findFirst({
      where: { id: groupId, deletedAt: null },
      select: {
        id: true,
        invoiceNumber: true,
        totalAmount: true,
        status: true,
        actualPaymentDate: true,
        counterparty: { select: { id: true, name: true } },
        transactions: {
          where: { deletedAt: null },
          select: transactionSelect,
          orderBy: { id: "asc" },
        },
      },
    });
    if (!group) return null;

    const transactions = group.transactions.map(mapTransaction);
    const txCount = transactions.length;
    const confirmedFilter = (t: WorkflowTransaction) => t.journalEntries.filter((je) => je.status === "confirmed");
    const journalizedCount = transactions.filter((t) => t.journalCompleted).length;
    const allRealizedCount = transactions.filter(
      (t) => confirmedFilter(t).length > 0 && confirmedFilter(t).every((je) => je.realizationStatus === "realized")
    ).length;
    const hasActualPaymentDate = !!group.actualPaymentDate;

    return {
      id: group.id,
      groupType: "invoice",
      label: group.invoiceNumber ?? `INV-${group.id}`,
      counterpartyName: group.counterparty.name,
      counterpartyId: group.counterparty.id,
      totalAmount: group.totalAmount,
      status: group.status,
      actualPaymentDate: group.actualPaymentDate,
      category: determineCategory(group.status, txCount, journalizedCount, allRealizedCount, hasActualPaymentDate),
      isAllJournalized: txCount > 0 && journalizedCount === txCount,
      isAllRealized: txCount > 0 && allRealizedCount === txCount,
      hasActualPaymentDate,
      transactions,
    };
  }

  // payment
  const group = await prisma.paymentGroup.findFirst({
    where: { id: groupId, deletedAt: null },
    select: {
      id: true,
      referenceCode: true,
      totalAmount: true,
      status: true,
      actualPaymentDate: true,
      counterparty: { select: { id: true, name: true } },
      transactions: {
        where: { deletedAt: null },
        select: transactionSelect,
        orderBy: { id: "asc" },
      },
    },
  });
  if (!group) return null;

  const transactions = group.transactions.map(mapTransaction);
  const txCount = transactions.length;
  const confirmedFilter = (t: WorkflowTransaction) => t.journalEntries.filter((je) => je.status === "confirmed");
  const journalizedCount = transactions.filter((t) => t.journalCompleted).length;
  const allRealizedCount = transactions.filter(
    (t) => confirmedFilter(t).length > 0 && confirmedFilter(t).every((je) => je.realizationStatus === "realized")
  ).length;
  const hasActualPaymentDate = !!group.actualPaymentDate;

  return {
    id: group.id,
    groupType: "payment",
    label: group.referenceCode ?? `PG-${group.id}`,
    counterpartyName: group.counterparty?.name ?? "（未設定）",
    counterpartyId: group.counterparty?.id ?? 0,
    totalAmount: group.totalAmount,
    status: group.status,
    actualPaymentDate: group.actualPaymentDate,
    category: determineCategory(group.status, txCount, journalizedCount, allRealizedCount, hasActualPaymentDate),
    isAllJournalized: txCount > 0 && journalizedCount === txCount,
    isAllRealized: txCount > 0 && allRealizedCount === txCount,
    hasActualPaymentDate,
    transactions,
  };
}

// ============================================
// 3. toggleTransactionJournalCompleted（仕訳完了フラグの切替）
// ============================================

export async function toggleTransactionJournalCompleted(transactionId: number) {
  const transaction = await prisma.transaction.findFirst({
    where: { id: transactionId, deletedAt: null },
    select: { id: true, journalCompleted: true },
  });

  if (!transaction) {
    throw new Error("取引が見つかりません");
  }

  await prisma.transaction.update({
    where: { id: transactionId },
    data: { journalCompleted: !transaction.journalCompleted },
  });

  revalidatePath("/accounting/workflow");
}

// ============================================
// 3b. setTransactionJournalCompleted（仕訳完了フラグの明示的セット）
// ============================================

export async function setTransactionJournalCompleted(
  transactionId: number,
  completed: boolean
) {
  const transaction = await prisma.transaction.findFirst({
    where: { id: transactionId, deletedAt: null },
    select: { id: true },
  });

  if (!transaction) {
    throw new Error("取引が見つかりません");
  }

  await prisma.transaction.update({
    where: { id: transactionId },
    data: { journalCompleted: completed },
  });

  revalidatePath("/accounting/workflow");
}

// ============================================
// 4. checkAndCompleteTransaction
// ============================================

export async function checkAndCompleteTransaction(transactionId: number) {
  const transaction = await prisma.transaction.findFirst({
    where: { id: transactionId, deletedAt: null },
    select: {
      id: true,
      status: true,
      invoiceGroupId: true,
      paymentGroupId: true,
      journalEntries: {
        where: { deletedAt: null, status: "confirmed" },
        select: { id: true, realizationStatus: true },
      },
    },
  });

  if (!transaction) return;
  if (!["awaiting_accounting", "journalized"].includes(transaction.status)) return;

  const confirmedEntries = transaction.journalEntries;
  if (confirmedEntries.length === 0) return;

  // confirmed仕訳があればjournalizedへ（paidは消込経由でのみ遷移する）
  if (transaction.status === "awaiting_accounting") {
    await prisma.transaction.update({
      where: { id: transactionId },
      data: { status: "journalized" },
    });
  }

  revalidatePath("/accounting/workflow");
}

// ============================================
// 5. approvePaymentGroup（経理承認：pending_approval → awaiting_accounting）
// ============================================

export async function approvePaymentGroup(groupId: number) {
  const session = await getSession();
  const staffId = session.id;

  const group = await prisma.paymentGroup.findFirst({
    where: { id: groupId, deletedAt: null },
    select: { id: true, status: true },
  });
  if (!group) throw new Error("支払グループが見つかりません");
  if (group.status !== "pending_approval") {
    throw new Error("このグループは経理承認待ちではありません");
  }

  await prisma.paymentGroup.update({
    where: { id: groupId },
    data: {
      status: "awaiting_accounting",
      approver: { connect: { id: staffId } },
      approvedAt: new Date(),
      updater: { connect: { id: staffId } },
    },
  });

  // 子の Transaction も pending_approval → awaiting_accounting
  await prisma.transaction.updateMany({
    where: { paymentGroupId: groupId, deletedAt: null, status: "pending_approval" },
    data: { status: "awaiting_accounting" },
  });

  revalidatePath("/accounting/workflow");
}

// ============================================
// 6. rejectPaymentGroup（経理が差し戻し：pending_approval → returned）
// ============================================

export async function rejectPaymentGroup(groupId: number, reason?: string) {
  const session = await getSession();
  const staffId = session.id;

  const group = await prisma.paymentGroup.findFirst({
    where: { id: groupId, deletedAt: null },
    select: { id: true, status: true },
  });
  if (!group) throw new Error("支払グループが見つかりません");
  if (group.status !== "pending_approval") {
    throw new Error("このグループは経理承認待ちではありません");
  }

  await prisma.paymentGroup.update({
    where: { id: groupId },
    data: {
      status: "returned",
      updatedBy: staffId,
    },
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

  revalidatePath("/accounting/workflow");
}

// ============================================
// 7. getPendingApprovalDetail（承認待ち詳細）
// ============================================

export type PendingApprovalDetail = {
  id: number;
  referenceCode: string | null;
  counterpartyId: number | null;
  counterpartyName: string;
  customCounterpartyName: string | null;
  operatingCompanyName: string;
  projectId: number | null;
  projectName: string | null;
  totalAmount: number | null;
  taxAmount: number | null;
  approverName: string | null;
  createdByName: string;
  createdAt: Date;
  transaction: {
    id: number;
    expenseCategoryId: number | null;
    expenseCategoryName: string | null;
    paymentMethodId: number | null;
    paymentMethodName: string | null;
    amount: number;
    taxAmount: number;
    taxRate: number;
    periodFrom: Date;
    periodTo: Date;
    paymentDueDate: Date | null;
    note: string | null;
    sourceType: string | null;
    expenseOwners: { staffName: string | null; customName: string | null }[];
  } | null;
  counterparties: { id: number; name: string; displayId: string | null; companyCode: string | null }[];
  expenseCategories: { id: number; name: string }[];
  paymentMethods: { id: number; name: string }[];
};

export async function getPendingApprovalDetail(groupId: number): Promise<PendingApprovalDetail | null> {
  const pg = await prisma.paymentGroup.findFirst({
    where: { id: groupId, deletedAt: null },
    select: {
      id: true,
      referenceCode: true,
      counterpartyId: true,
      customCounterpartyName: true,
      operatingCompanyId: true,
      projectId: true,
      totalAmount: true,
      taxAmount: true,
      createdAt: true,
      counterparty: { select: { name: true } },
      operatingCompany: { select: { companyName: true } },
      project: { select: { name: true } },
      approver: { select: { name: true } },
      creator: { select: { name: true } },
      transactions: {
        where: { deletedAt: null },
        take: 1,
        select: {
          id: true,
          expenseCategoryId: true,
          paymentMethodId: true,
          amount: true,
          taxAmount: true,
          taxRate: true,
          periodFrom: true,
          periodTo: true,
          paymentDueDate: true,
          note: true,
          sourceType: true,
          expenseCategory: { select: { name: true } },
          paymentMethod: { select: { name: true } },
          expenseOwners: {
            select: { staff: { select: { name: true } }, customName: true },
          },
        },
      },
    },
  });

  if (!pg) return null;

  const projectId = pg.projectId;
  const [counterparties, expenseCategories, paymentMethods] = await Promise.all([
    prisma.counterparty.findMany({
      where: { deletedAt: null, mergedIntoId: null, isActive: true },
      select: { id: true, name: true, displayId: true, company: { select: { companyCode: true } } },
      orderBy: { id: "desc" },
    }),
    projectId
      ? prisma.expenseCategory.findMany({
          where: { deletedAt: null, isActive: true, projectId, type: { in: ["expense", "both"] } },
          select: { id: true, name: true },
          orderBy: { displayOrder: "asc" },
        })
      : Promise.resolve([]),
    prisma.paymentMethod.findMany({
      where: { deletedAt: null, isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const tx = pg.transactions[0] ?? null;

  return {
    id: pg.id,
    referenceCode: pg.referenceCode,
    counterpartyId: pg.counterpartyId,
    counterpartyName: pg.counterparty?.name ?? "（未設定）",
    customCounterpartyName: pg.customCounterpartyName,
    operatingCompanyName: pg.operatingCompany.companyName,
    projectId: pg.projectId,
    projectName: pg.project?.name ?? null,
    totalAmount: pg.totalAmount,
    taxAmount: pg.taxAmount,
    approverName: pg.approver?.name ?? null,
    createdByName: pg.creator.name,
    createdAt: pg.createdAt,
    transaction: tx
      ? {
          id: tx.id,
          expenseCategoryId: tx.expenseCategoryId,
          expenseCategoryName: tx.expenseCategory?.name ?? null,
          paymentMethodId: tx.paymentMethodId,
          paymentMethodName: tx.paymentMethod?.name ?? null,
          amount: tx.amount,
          taxAmount: tx.taxAmount,
          taxRate: tx.taxRate,
          periodFrom: tx.periodFrom,
          periodTo: tx.periodTo,
          paymentDueDate: tx.paymentDueDate,
          note: tx.note,
          sourceType: tx.sourceType,
          expenseOwners: tx.expenseOwners.map((o) => ({
            staffName: o.staff?.name ?? null,
            customName: o.customName,
          })),
        }
      : null,
    counterparties: counterparties.map((c) => ({
      id: c.id,
      name: c.name,
      displayId: c.displayId,
      companyCode: c.company?.companyCode ?? null,
    })),
    expenseCategories,
    paymentMethods,
  };
}

// ============================================
// 8. updateAndApprovePaymentGroup（経理が編集して承認）
// ============================================

export async function updateAndApprovePaymentGroup(
  groupId: number,
  updates: {
    counterpartyId?: number;
    expenseCategoryId?: number | null;
    paymentMethodId?: number | null;
    amount?: number;
    taxAmount?: number;
    taxRate?: number;
    note?: string | null;
  }
) {
  const session = await getSession();
  const staffId = session.id;

  const group = await prisma.paymentGroup.findFirst({
    where: { id: groupId, deletedAt: null },
    select: {
      id: true,
      status: true,
      counterpartyId: true,
      operatingCompanyId: true,
      projectId: true,
      totalAmount: true,
      taxAmount: true,
      customCounterpartyName: true,
      createdBy: true,
      transactions: {
        where: { deletedAt: null },
        take: 1,
        select: {
          id: true,
          expenseCategoryId: true,
          paymentMethodId: true,
          amount: true,
          taxAmount: true,
          taxRate: true,
          periodFrom: true,
          periodTo: true,
          paymentDueDate: true,
          note: true,
          costCenterId: true,
        },
      },
    },
  });
  if (!group) throw new Error("支払グループが見つかりません");
  if (group.status !== "pending_approval") {
    throw new Error("このグループは経理承認待ちではありません");
  }

  // 取引先の確定チェック
  const finalCounterpartyId = updates.counterpartyId ?? group.counterpartyId;
  if (!finalCounterpartyId) {
    throw new Error("取引先を選択してください。手入力のままでは承認できません。");
  }

  await prisma.$transaction(async (tx) => {
    // PaymentGroup更新
    const pgUpdate: Record<string, unknown> = {
      status: "awaiting_accounting",
      approver: { connect: { id: staffId } },
      approvedAt: new Date(),
      updater: { connect: { id: staffId } },
      customCounterpartyName: null,
      counterparty: { connect: { id: finalCounterpartyId } },
    };
    if (updates.amount !== undefined) {
      pgUpdate.totalAmount = updates.amount;
      pgUpdate.taxAmount = updates.taxAmount ?? 0;
    }

    await tx.paymentGroup.update({
      where: { id: groupId },
      data: pgUpdate,
    });

    const existingTx = group.transactions[0];
    if (existingTx) {
      // Transaction が既に存在する場合は更新
      const txUpdate: Record<string, unknown> = {
        status: "awaiting_accounting",
        counterparty: { connect: { id: finalCounterpartyId } },
      };
      if (updates.expenseCategoryId !== undefined) {
        if (updates.expenseCategoryId) {
          txUpdate.expenseCategory = { connect: { id: updates.expenseCategoryId } };
        } else {
          txUpdate.expenseCategory = { disconnect: true };
        }
      }
      if (updates.paymentMethodId !== undefined) {
        if (updates.paymentMethodId) {
          txUpdate.paymentMethod = { connect: { id: updates.paymentMethodId } };
        } else {
          txUpdate.paymentMethod = { disconnect: true };
        }
      }
      if (updates.amount !== undefined) {
        txUpdate.amount = updates.amount;
        txUpdate.taxAmount = updates.taxAmount ?? 0;
        txUpdate.taxRate = updates.taxRate ?? 10;
      }
      if (updates.note !== undefined) {
        txUpdate.note = updates.note;
      }

      await tx.transaction.update({
        where: { id: existingTx.id },
        data: txUpdate,
      });
    } else {
      // Transaction が未作成の場合（手入力取引先で承認時に初めて作成）
      const amt = updates.amount ?? group.totalAmount ?? 0;
      const taxAmt = updates.taxAmount ?? group.taxAmount ?? 0;
      const taxRate = updates.taxRate ?? 10;
      const now = new Date();

      await tx.transaction.create({
        data: {
          paymentGroupId: groupId,
          counterpartyId: finalCounterpartyId,
          expenseCategoryId: updates.expenseCategoryId ?? null,
          costCenterId: group.transactions[0]?.costCenterId ?? null,
          projectId: group.projectId,
          paymentMethodId: updates.paymentMethodId ?? null,
          type: "expense",
          amount: amt,
          taxAmount: taxAmt,
          taxRate,
          taxType: "tax_included",
          periodFrom: now,
          periodTo: now,
          status: "awaiting_accounting",
          note: updates.note ?? null,
          sourceType: "manual",
          hasExpenseOwner: false,
          createdBy: staffId,
        },
      });
    }
  });

  revalidatePath("/accounting/workflow");
}

// ============================================
// 9. createCounterpartyFromApproval（承認モーダルから取引先を新規追加）
// ============================================

export async function createCounterpartyFromApproval(
  name: string
): Promise<{ id: number; displayId: string }> {
  const session = await getSession();
  const staffId = session.id;

  if (!name.trim()) throw new Error("取引先名は必須です");

  const counterparty = await prisma.counterparty.create({
    data: {
      name: name.trim(),
      counterpartyType: "other",
      isActive: true,
      createdBy: staffId,
    },
  });

  const displayId = `TP-${counterparty.id}`;
  await prisma.counterparty.update({
    where: { id: counterparty.id },
    data: { displayId },
  });

  revalidatePath("/accounting/workflow");
  return { id: counterparty.id, displayId };
}
