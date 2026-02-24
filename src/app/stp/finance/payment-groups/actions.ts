"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { requireEdit } from "@/lib/auth";
import { recordChangeLog } from "@/app/accounting/changelog/actions";

// ============================================
// 型定義
// ============================================

export type PaymentGroupListItem = {
  id: number;
  counterpartyId: number;
  counterpartyName: string;
  operatingCompanyId: number;
  operatingCompanyName: string;
  targetMonth: string; // YYYY-MM
  expectedPaymentDate: string | null;
  actualPaymentDate: string | null;
  totalAmount: number | null;
  taxAmount: number | null;
  requestedPdfName: string | null;
  receivedPdfPath: string | null;
  receivedPdfFileName: string | null;
  status: string;
  confirmedByName: string | null;
  confirmedAt: string | null;
  transactionCount: number;
  createdByName: string;
  createdAt: string;
};

export type UngroupedExpenseTransaction = {
  id: number;
  type: string;
  counterpartyId: number;
  counterpartyName: string;
  expenseCategoryName: string;
  amount: number;
  taxAmount: number;
  taxRate: number;
  taxType: string;
  periodFrom: string;
  periodTo: string;
  note: string | null;
};

// ============================================
// 一覧取得
// ============================================

export async function getPaymentGroups(
  projectId?: number
): Promise<PaymentGroupListItem[]> {
  const records = await prisma.paymentGroup.findMany({
    where: { deletedAt: null, ...(projectId ? { projectId } : {}) },
    include: {
      counterparty: true,
      operatingCompany: true,
      transactions: { where: { deletedAt: null }, select: { id: true } },
      creator: true,
      confirmer: true,
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
  });

  return records.map((r) => ({
    id: r.id,
    counterpartyId: r.counterpartyId,
    counterpartyName: r.counterparty.name,
    operatingCompanyId: r.operatingCompanyId,
    operatingCompanyName: r.operatingCompany.companyName,
    targetMonth: r.targetMonth.toISOString().slice(0, 7), // YYYY-MM
    expectedPaymentDate:
      r.expectedPaymentDate?.toISOString().split("T")[0] ?? null,
    actualPaymentDate:
      r.actualPaymentDate?.toISOString().split("T")[0] ?? null,
    totalAmount: r.totalAmount,
    taxAmount: r.taxAmount,
    requestedPdfName: r.requestedPdfName,
    receivedPdfPath: r.receivedPdfPath,
    receivedPdfFileName: r.receivedPdfFileName,
    status: r.status,
    confirmedByName: r.confirmer?.name ?? null,
    confirmedAt: r.confirmedAt?.toISOString().split("T")[0] ?? null,
    transactionCount: r.transactions.length,
    createdByName: r.creator.name,
    createdAt: r.createdAt.toISOString().split("T")[0],
  }));
}

// ============================================
// 未グループ化の経費取引を取得
// ============================================

export async function getUngroupedExpenseTransactions(
  counterpartyId?: number,
  projectId?: number
): Promise<UngroupedExpenseTransaction[]> {
  const where: Record<string, unknown> = {
    deletedAt: null,
    type: "expense",
    status: "confirmed",
    paymentGroupId: null,
    ...(projectId ? { projectId } : {}),
  };
  if (counterpartyId) {
    where.counterpartyId = counterpartyId;
  }

  const records = await prisma.transaction.findMany({
    where,
    include: {
      counterparty: true,
      expenseCategory: true,
    },
    orderBy: [{ periodFrom: "asc" }, { id: "asc" }],
  });

  return records.map((r) => ({
    id: r.id,
    type: r.type,
    counterpartyId: r.counterpartyId,
    counterpartyName: r.counterparty.name,
    expenseCategoryName: r.expenseCategory.name,
    amount: r.amount,
    taxAmount: r.taxAmount,
    taxRate: r.taxRate,
    taxType: r.taxType,
    periodFrom: r.periodFrom.toISOString().split("T")[0],
    periodTo: r.periodTo.toISOString().split("T")[0],
    note: r.note,
  }));
}

// ============================================
// 作成
// ============================================

export async function createPaymentGroup(data: {
  counterpartyId: number;
  operatingCompanyId: number;
  targetMonth: string; // YYYY-MM
  expectedPaymentDate?: string | null;
  requestedPdfName?: string | null;
  transactionIds: number[];
  projectId?: number;
}): Promise<{ id: number }> {
  const user = await requireEdit("stp");

  const result = await prisma.$transaction(async (tx) => {
    // 選択された取引を検証
    const transactions = await tx.transaction.findMany({
      where: {
        id: { in: data.transactionIds },
        deletedAt: null,
        status: "confirmed",
        paymentGroupId: null,
        type: "expense",
      },
    });

    if (transactions.length === 0) {
      throw new Error("グループ化できる取引がありません");
    }

    // 全取引が同一取引先か確認
    const counterpartyIds = new Set(transactions.map((t) => t.counterpartyId));
    if (counterpartyIds.size > 1) {
      throw new Error(
        "異なる取引先の取引は同じ支払グループに入れられません"
      );
    }
    if (!counterpartyIds.has(data.counterpartyId)) {
      throw new Error("取引先が一致しません");
    }

    // 金額計算
    let subtotal = 0;
    let taxTotal = 0;
    for (const t of transactions) {
      if (t.taxType === "tax_excluded") {
        subtotal += t.amount;
        taxTotal += t.taxAmount;
      } else {
        // 内税の場合: 金額から税額を引いたのが小計
        subtotal += t.amount - t.taxAmount;
        taxTotal += t.taxAmount;
      }
    }

    // PaymentGroup作成
    const group = await tx.paymentGroup.create({
      data: {
        counterpartyId: data.counterpartyId,
        operatingCompanyId: data.operatingCompanyId,
        targetMonth: new Date(data.targetMonth + "-01"),
        expectedPaymentDate: data.expectedPaymentDate
          ? new Date(data.expectedPaymentDate)
          : null,
        requestedPdfName: data.requestedPdfName ?? null,
        totalAmount: subtotal + taxTotal,
        taxAmount: taxTotal,
        projectId: data.projectId ?? null,
        status: "before_request",
        createdBy: user.id,
      },
    });

    // 取引をグループに紐づけ
    await tx.transaction.updateMany({
      where: { id: { in: data.transactionIds } },
      data: { paymentGroupId: group.id },
    });

    return { id: group.id };
  });

  revalidatePath("/stp/finance/payment-groups");
  revalidatePath("/stp/finance/transactions");
  return result;
}

// ============================================
// 更新
// ============================================

export async function updatePaymentGroup(
  id: number,
  data: {
    expectedPaymentDate?: string | null;
    requestedPdfName?: string | null;
  }
): Promise<void> {
  const user = await requireEdit("stp");

  const group = await prisma.paymentGroup.findUnique({
    where: { id, deletedAt: null },
  });
  if (!group) throw new Error("支払グループが見つかりません");

  // before_request, rejected のみ編集可能
  if (!["before_request", "rejected"].includes(group.status)) {
    throw new Error("このステータスでは編集できません");
  }

  const updateData: Record<string, unknown> = {
    updatedBy: user.id,
  };

  if ("expectedPaymentDate" in data)
    updateData.expectedPaymentDate = data.expectedPaymentDate
      ? new Date(data.expectedPaymentDate)
      : null;
  if ("requestedPdfName" in data)
    updateData.requestedPdfName = data.requestedPdfName ?? null;

  await prisma.paymentGroup.update({
    where: { id },
    data: updateData,
  });

  revalidatePath("/stp/finance/payment-groups");
}

// ============================================
// 削除（論理削除）
// ============================================

export async function deletePaymentGroup(
  id: number,
  deleteTransactions?: boolean
): Promise<void> {
  const user = await requireEdit("stp");

  const group = await prisma.paymentGroup.findUnique({
    where: { id, deletedAt: null },
  });
  if (!group) throw new Error("支払グループが見つかりません");

  // before_request のみ削除可能
  if (group.status !== "before_request") {
    throw new Error(
      "「依頼前」ステータスの支払グループのみ削除できます"
    );
  }

  await prisma.$transaction(async (tx) => {
    if (deleteTransactions) {
      // 紐づく取引も論理削除
      await tx.transaction.updateMany({
        where: { paymentGroupId: id, deletedAt: null },
        data: { deletedAt: new Date(), paymentGroupId: null },
      });
    } else {
      // 取引のグループ紐付けを解除
      await tx.transaction.updateMany({
        where: { paymentGroupId: id },
        data: { paymentGroupId: null },
      });
    }

    // 論理削除
    await tx.paymentGroup.update({
      where: { id },
      data: { deletedAt: new Date(), updatedBy: user.id },
    });
  });

  revalidatePath("/stp/finance/payment-groups");
  revalidatePath("/stp/finance/transactions");
}

// ============================================
// 請求書発行依頼
// ============================================

export async function requestInvoice(
  paymentGroupId: number
): Promise<void> {
  const user = await requireEdit("stp");

  const group = await prisma.paymentGroup.findUnique({
    where: { id: paymentGroupId, deletedAt: null },
  });
  if (!group) throw new Error("支払グループが見つかりません");

  if (group.status !== "before_request") {
    throw new Error(
      "「依頼前」ステータスの支払グループのみ請求書発行依頼できます"
    );
  }

  if (!group.requestedPdfName) {
    throw new Error(
      "請求書発行依頼にはPDFファイル名の指定が必要です"
    );
  }

  await prisma.paymentGroup.update({
    where: { id: paymentGroupId },
    data: { status: "requested", updatedBy: user.id },
  });

  revalidatePath("/stp/finance/payment-groups");
}

// ============================================
// 請求書確認（受領した請求書を承認）
// ============================================

export async function confirmReceivedInvoice(
  paymentGroupId: number,
  data: {
    expectedPaymentDate?: string;
  }
): Promise<void> {
  const user = await requireEdit("stp");

  const group = await prisma.paymentGroup.findUnique({
    where: { id: paymentGroupId, deletedAt: null },
  });
  if (!group) throw new Error("支払グループが見つかりません");

  if (group.status !== "invoice_received") {
    throw new Error(
      "「請求書受領済み」ステータスの支払グループのみ確認できます"
    );
  }

  const updateData: Record<string, unknown> = {
    status: "confirmed",
    confirmedBy: user.id,
    confirmedAt: new Date(),
    updatedBy: user.id,
  };

  if (data.expectedPaymentDate) {
    updateData.expectedPaymentDate = new Date(data.expectedPaymentDate);
  }

  await prisma.paymentGroup.update({
    where: { id: paymentGroupId },
    data: updateData,
  });

  revalidatePath("/stp/finance/payment-groups");
}

// ============================================
// 請求書差し戻し
// ============================================

export async function rejectInvoice(
  paymentGroupId: number,
  reason: string
): Promise<void> {
  const user = await requireEdit("stp");

  const group = await prisma.paymentGroup.findUnique({
    where: { id: paymentGroupId, deletedAt: null },
  });
  if (!group) throw new Error("支払グループが見つかりません");

  if (group.status !== "invoice_received") {
    throw new Error(
      "「請求書受領済み」ステータスの支払グループのみ差し戻しできます"
    );
  }

  await prisma.$transaction(async (tx) => {
    // ステータスを rejected に変更
    await tx.paymentGroup.update({
      where: { id: paymentGroupId },
      data: { status: "rejected", updatedBy: user.id },
    });

    // 理由をコメントとして保存
    await tx.transactionComment.create({
      data: {
        paymentGroupId,
        body: reason,
        commentType: "return",
        createdBy: user.id,
      },
    });
  });

  revalidatePath("/stp/finance/payment-groups");
}

// ============================================
// ステータス変更（汎用）
// ============================================

export async function updatePaymentGroupStatus(
  id: number,
  newStatus: string
): Promise<void> {
  const user = await requireEdit("stp");

  const group = await prisma.paymentGroup.findUnique({
    where: { id, deletedAt: null },
  });
  if (!group) throw new Error("支払グループが見つかりません");

  // 遷移バリデーション
  const validTransitions: Record<string, string[]> = {
    before_request: ["requested"],
    requested: ["invoice_received"],
    invoice_received: ["confirmed", "rejected"],
    rejected: ["re_requested"],
    re_requested: ["invoice_received"],
    confirmed: ["awaiting_accounting", "paid"],
  };

  const allowed = validTransitions[group.status] ?? [];
  if (!allowed.includes(newStatus)) {
    throw new Error(
      `ステータスを「${group.status}」から「${newStatus}」に変更できません`
    );
  }

  const updateData: Record<string, unknown> = {
    status: newStatus,
    updatedBy: user.id,
  };

  // paid に遷移する場合は実際の支払日を設定
  if (newStatus === "paid") {
    updateData.actualPaymentDate = new Date();
  }

  await prisma.paymentGroup.update({
    where: { id },
    data: updateData,
  });

  revalidatePath("/stp/finance/payment-groups");
}

// ============================================
// 取引の追加
// ============================================

export async function addTransactionToPaymentGroup(
  groupId: number,
  transactionIds: number[]
): Promise<void> {
  const user = await requireEdit("stp");

  const group = await prisma.paymentGroup.findUnique({
    where: { id: groupId, deletedAt: null },
    include: { transactions: { where: { deletedAt: null } } },
  });
  if (!group) throw new Error("支払グループが見つかりません");

  // before_request, rejected のみ追加可能
  if (!["before_request", "rejected"].includes(group.status)) {
    throw new Error("このステータスでは取引を追加できません");
  }

  // 追加する取引を検証
  const transactions = await prisma.transaction.findMany({
    where: {
      id: { in: transactionIds },
      deletedAt: null,
      status: "confirmed",
      paymentGroupId: null,
      type: "expense",
      counterpartyId: group.counterpartyId,
    },
  });

  if (transactions.length === 0) {
    throw new Error("追加できる取引がありません");
  }

  await prisma.$transaction(async (tx) => {
    // 取引をグループに紐づけ
    await tx.transaction.updateMany({
      where: { id: { in: transactions.map((t) => t.id) } },
      data: { paymentGroupId: groupId },
    });

    // 金額再計算
    const allTransactions = [...group.transactions, ...transactions];
    let subtotal = 0;
    let taxTotal = 0;
    for (const t of allTransactions) {
      if (t.taxType === "tax_excluded") {
        subtotal += t.amount;
        taxTotal += t.taxAmount;
      } else {
        subtotal += t.amount - t.taxAmount;
        taxTotal += t.taxAmount;
      }
    }

    await tx.paymentGroup.update({
      where: { id: groupId },
      data: {
        totalAmount: subtotal + taxTotal,
        taxAmount: taxTotal,
        updatedBy: user.id,
      },
    });
  });

  revalidatePath("/stp/finance/payment-groups");
  revalidatePath("/stp/finance/transactions");
}

// ============================================
// 取引の削除（グループから外す）
// ============================================

export async function removeTransactionFromPaymentGroup(
  groupId: number,
  transactionId: number
): Promise<void> {
  const user = await requireEdit("stp");

  const group = await prisma.paymentGroup.findUnique({
    where: { id: groupId, deletedAt: null },
    include: { transactions: { where: { deletedAt: null } } },
  });
  if (!group) throw new Error("支払グループが見つかりません");

  // before_request, rejected のみ削除可能
  if (!["before_request", "rejected"].includes(group.status)) {
    throw new Error("このステータスでは取引を削除できません");
  }

  await prisma.$transaction(async (tx) => {
    // 取引のグループ紐付けを解除（所属グループを検証）
    await tx.transaction.update({
      where: { id: transactionId, paymentGroupId: groupId },
      data: { paymentGroupId: null },
    });

    // 金額再計算
    const remaining = group.transactions.filter(
      (t) => t.id !== transactionId
    );
    let subtotal = 0;
    let taxTotal = 0;
    for (const t of remaining) {
      if (t.taxType === "tax_excluded") {
        subtotal += t.amount;
        taxTotal += t.taxAmount;
      } else {
        subtotal += t.amount - t.taxAmount;
        taxTotal += t.taxAmount;
      }
    }

    await tx.paymentGroup.update({
      where: { id: groupId },
      data: {
        totalAmount: subtotal + taxTotal,
        taxAmount: taxTotal,
        updatedBy: user.id,
      },
    });
  });

  revalidatePath("/stp/finance/payment-groups");
  revalidatePath("/stp/finance/transactions");
}

// ============================================
// グループ内取引の取得
// ============================================

export type PaymentGroupTransaction = {
  id: number;
  expenseCategoryName: string;
  amount: number;
  taxAmount: number;
  taxRate: number;
  taxType: string;
  periodFrom: string;
  periodTo: string;
  note: string | null;
};

export async function getPaymentGroupTransactions(
  groupId: number
): Promise<PaymentGroupTransaction[]> {
  const records = await prisma.transaction.findMany({
    where: { paymentGroupId: groupId, deletedAt: null },
    include: { expenseCategory: true },
    orderBy: [{ periodFrom: "asc" }, { id: "asc" }],
  });

  return records.map((r) => ({
    id: r.id,
    expenseCategoryName: r.expenseCategory.name,
    amount: r.amount,
    taxAmount: r.taxAmount,
    taxRate: r.taxRate,
    taxType: r.taxType,
    periodFrom: r.periodFrom.toISOString().split("T")[0],
    periodTo: r.periodTo.toISOString().split("T")[0],
    note: r.note,
  }));
}

// ============================================
// 経理へ引渡（awaiting_accounting へ遷移）
// ============================================

export async function submitPaymentGroupToAccounting(
  id: number
): Promise<void> {
  const user = await requireEdit("stp");

  const group = await prisma.paymentGroup.findUnique({
    where: { id, deletedAt: null },
    include: {
      transactions: {
        where: { deletedAt: null },
        include: {
          allocationTemplate: {
            include: {
              lines: { where: { costCenterId: { not: null } } },
            },
          },
          allocationConfirmations: true,
        },
      },
    },
  });
  if (!group) throw new Error("支払グループが見つかりません");

  // confirmed のみ遷移可能
  if (group.status !== "confirmed") {
    throw new Error(
      "「確認済み」ステータスの支払のみ経理へ引渡できます"
    );
  }

  // 按分確定チェック: allocationTemplateId がある取引は全プロジェクトの按分確定が必要
  for (const tx of group.transactions) {
    if (tx.allocationTemplateId && tx.allocationTemplate) {
      const requiredCostCenterIds = tx.allocationTemplate.lines
        .filter((line) => line.costCenterId !== null)
        .map((line) => line.costCenterId!);

      const confirmedCostCenterIds = new Set(
        tx.allocationConfirmations
          .filter((ac) => ac.confirmedAt !== null)
          .map((ac) => ac.costCenterId)
      );

      const allConfirmed = requiredCostCenterIds.every((ccId) =>
        confirmedCostCenterIds.has(ccId)
      );

      if (!allConfirmed) {
        throw new Error(
          "按分確定が完了していない取引が含まれています。全プロジェクトの按分確定を完了してください。"
        );
      }
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.paymentGroup.update({
      where: { id },
      data: {
        status: "awaiting_accounting",
        updatedBy: user.id,
      },
    });

    await recordChangeLog(
      {
        tableName: "PaymentGroup",
        recordId: id,
        changeType: "update",
        oldData: { status: group.status },
        newData: { status: "awaiting_accounting" },
      },
      user.id,
      tx
    );
  });

  revalidatePath("/stp/finance/payment-groups");
}
