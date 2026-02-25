"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { requireEdit } from "@/lib/auth";
import { generateInvoiceGroupNumber } from "@/lib/finance/invoice-number";
import { recordChangeLog } from "@/app/accounting/changelog/actions";
import { requireStpProjectId } from "@/lib/project-context";
import fs from "fs/promises";
import path from "path";

// ============================================
// 税額計算ヘルパー（取引の税額を単純合計）
// ============================================

function calcGroupTotals(transactions: { amount: number; taxAmount: number; taxRate: number; taxType: string }[]) {
  let subtotal = 0;
  let taxTotal = 0;
  for (const t of transactions) {
    if (t.taxType === "tax_excluded") {
      subtotal += t.amount;
      taxTotal += t.taxAmount;
    } else {
      subtotal += t.amount - t.taxAmount;
      taxTotal += t.taxAmount;
    }
  }
  return { subtotal, taxAmount: taxTotal, totalAmount: subtotal + taxTotal };
}

// ============================================
// 型定義（types.ts から再エクスポート）
// ============================================

import type {
  InvoiceGroupListItem,
  UngroupedAllocationItem,
  UngroupedTransaction,
} from "./types";

export type {
  InvoiceGroupListItem,
  UngroupedAllocationItem,
  UngroupedTransaction,
} from "./types";

// ============================================
// 一覧取得
// ============================================

export async function getInvoiceGroups(
  projectId?: number
): Promise<InvoiceGroupListItem[]> {
  const records = await prisma.invoiceGroup.findMany({
    where: { deletedAt: null, ...(projectId ? { projectId } : {}) },
    include: {
      counterparty: true,
      operatingCompany: true,
      bankAccount: true,
      originalInvoiceGroup: { select: { invoiceNumber: true } },
      transactions: { where: { deletedAt: null }, select: { id: true } },
      allocationItems: { select: { id: true } },
      creator: true,
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
  });

  return records.map((r) => ({
    id: r.id,
    counterpartyId: r.counterpartyId,
    counterpartyName: r.counterparty.name,
    operatingCompanyId: r.operatingCompanyId,
    operatingCompanyName: r.operatingCompany.companyName,
    bankAccountId: r.bankAccountId,
    bankAccountLabel: r.bankAccount
      ? `${r.bankAccount.bankName} ${r.bankAccount.branchName} ${r.bankAccount.accountNumber}`
      : null,
    invoiceNumber: r.invoiceNumber,
    invoiceDate: r.invoiceDate?.toISOString().split("T")[0] ?? null,
    paymentDueDate: r.paymentDueDate?.toISOString().split("T")[0] ?? null,
    expectedPaymentDate: r.expectedPaymentDate?.toISOString().split("T")[0] ?? null,
    actualPaymentDate: r.actualPaymentDate?.toISOString().split("T")[0] ?? null,
    subtotal: r.subtotal,
    taxAmount: r.taxAmount,
    totalAmount: r.totalAmount,
    pdfPath: r.pdfPath,
    status: r.status,
    correctionType: r.correctionType,
    originalInvoiceGroupId: r.originalInvoiceGroupId,
    originalInvoiceNumber: r.originalInvoiceGroup?.invoiceNumber ?? null,
    transactionCount: r.transactions.length,
    allocationItemCount: r.allocationItems.length,
    createdByName: r.creator.name,
    createdAt: r.createdAt.toISOString().split("T")[0],
  }));
}

// 確認済み＆未グループ化の売上取引を取得（按分取引は除外）
export async function getUngroupedTransactions(
  counterpartyId?: number,
  projectId?: number
): Promise<UngroupedTransaction[]> {
  const where: Record<string, unknown> = {
    deletedAt: null,
    type: "revenue",
    status: "confirmed",
    invoiceGroupId: null,
    allocationTemplateId: null, // 按分取引は除外（AllocationGroupItem経由で処理）
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

// 未処理の按分取引（売上側、このPJのCostCenter分でまだAllocationGroupItemがない）
export async function getUngroupedAllocationItems(
  projectId?: number
): Promise<UngroupedAllocationItem[]> {
  if (!projectId) return [];

  // プロジェクトに紐づくCostCenterを取得
  const costCenters = await prisma.costCenter.findMany({
    where: {
      deletedAt: null,
      isActive: true,
      OR: [
        { projectId },
        { projectAssignments: { some: { projectId } } },
      ],
    },
    select: { id: true, name: true },
  });

  const targetCcIds = costCenters.map((cc) => cc.id);
  if (targetCcIds.length === 0) return [];

  // 按分テンプレートを持つ confirmed 売上取引を取得
  const transactions = await prisma.transaction.findMany({
    where: {
      deletedAt: null,
      type: "revenue",
      status: { in: ["confirmed", "awaiting_accounting", "resubmitted"] },
      allocationTemplateId: { not: null },
    },
    include: {
      counterparty: { select: { id: true, name: true } },
      expenseCategory: { select: { name: true } },
      allocationTemplate: {
        include: {
          lines: {
            include: { costCenter: { select: { id: true, name: true } } },
          },
        },
      },
      allocationGroupItems: {
        include: {
          costCenter: { select: { id: true, name: true } },
          invoiceGroup: { select: { invoiceNumber: true } },
        },
      },
      allocationConfirmations: true,
    },
  });

  const results: UngroupedAllocationItem[] = [];
  const ccNameMap = new Map(costCenters.map((cc) => [cc.id, cc.name]));

  for (const tx of transactions) {
    if (!tx.allocationTemplate) continue;

    const existingItemCcIds = new Set(
      tx.allocationGroupItems
        .filter((i) => i.groupType === "invoice")
        .map((i) => i.costCenterId)
    );
    const confirmedCcIds = new Set(tx.allocationConfirmations.map((ac) => ac.costCenterId));
    const amountIncludingTax = tx.amount + tx.taxAmount;

    for (const line of tx.allocationTemplate.lines) {
      if (line.costCenterId === null) continue;
      if (!targetCcIds.includes(line.costCenterId)) continue;
      if (existingItemCcIds.has(line.costCenterId)) continue;
      if (!confirmedCcIds.has(line.costCenterId)) continue;

      const rate = Number(line.allocationRate);
      const allocatedAmount = Math.floor((amountIncludingTax * rate) / 100);
      const allocatedTaxAmount = Math.floor((tx.taxAmount * rate) / 100);

      const ownerCcId = tx.allocationTemplate.ownerCostCenterId;
      const ownerCcName = ownerCcId
        ? tx.allocationTemplate.lines.find((l) => l.costCenterId === ownerCcId)?.costCenter?.name ?? null
        : null;

      const otherItems = tx.allocationTemplate.lines
        .filter((l) => l.costCenterId !== null && l.costCenterId !== line.costCenterId)
        .map((l) => {
          const item = tx.allocationGroupItems.find(
            (i) => i.costCenterId === l.costCenterId && i.groupType === "invoice"
          );
          return {
            costCenterName: l.costCenter?.name ?? "不明",
            groupLabel: item?.invoiceGroup?.invoiceNumber ?? null,
            isProcessed: !!item,
          };
        });

      results.push({
        transactionId: tx.id,
        counterpartyId: tx.counterparty!.id,
        counterpartyName: tx.counterparty!.name,
        expenseCategoryName: tx.expenseCategory.name,
        costCenterId: line.costCenterId,
        costCenterName: ccNameMap.get(line.costCenterId) ?? line.costCenter?.name ?? "不明",
        allocationRate: rate,
        allocatedAmount,
        allocatedTaxAmount,
        ownerCostCenterName: ownerCcName,
        isOwnerProject: ownerCcId !== null && targetCcIds.includes(ownerCcId),
        periodFrom: tx.periodFrom.toISOString().split("T")[0],
        periodTo: tx.periodTo.toISOString().split("T")[0],
        note: tx.note,
        otherItems,
      });
    }
  }

  return results;
}

// ============================================
// 作成
// ============================================

export async function createInvoiceGroup(data: {
  counterpartyId: number;
  operatingCompanyId: number;
  bankAccountId?: number | null;
  invoiceDate?: string | null;
  paymentDueDate?: string | null;
  expectedPaymentDate?: string | null;
  transactionIds: number[];
  projectId?: number;
}): Promise<{ id: number; invoiceNumber: string | null }> {
  const user = await requireEdit("stp");
  const stpProjectId = await requireStpProjectId();

  const result = await prisma.$transaction(async (tx) => {
    // P1-1: 按分取引は direct FK ルートでは追加不可
    const allocationTx = await tx.transaction.findFirst({
      where: {
        id: { in: data.transactionIds },
        allocationTemplateId: { not: null },
        deletedAt: null,
      },
    });
    if (allocationTx) {
      throw new Error("按分取引は直接請求に所属できません。按分明細として追加してください。");
    }

    // 選択された取引の金額を集計（projectIdでスコープ）
    const transactions = await tx.transaction.findMany({
      where: {
        id: { in: data.transactionIds },
        deletedAt: null,
        status: "confirmed",
        invoiceGroupId: null,
        type: "revenue",
        projectId: stpProjectId,
      },
    });

    if (transactions.length === 0) {
      throw new Error("対象の取引がありません");
    }

    // 部分成功を防止: 入力IDと取得IDが完全一致することを検証
    if (transactions.length !== data.transactionIds.length) {
      throw new Error(
        `指定された${data.transactionIds.length}件のうち${transactions.length}件しか対象外です。ステータス・プロジェクトを確認してください`
      );
    }

    // 全取引が同一取引先か確認
    const counterpartyIds = new Set(transactions.map((t) => t.counterpartyId));
    if (counterpartyIds.size > 1) {
      throw new Error("異なる取引先の取引は同じ請求に入れられません");
    }
    if (!counterpartyIds.has(data.counterpartyId)) {
      throw new Error("取引先が一致しません");
    }

    // 金額計算（取引の税額を単純合計）
    const { subtotal, taxAmount, totalAmount } = calcGroupTotals(transactions);

    // InvoiceGroup作成（サーバー側で取得したprojectIdを使用）
    const group = await tx.invoiceGroup.create({
      data: {
        counterpartyId: data.counterpartyId,
        operatingCompanyId: data.operatingCompanyId,
        bankAccountId: data.bankAccountId ?? null,
        invoiceDate: data.invoiceDate ? new Date(data.invoiceDate) : null,
        paymentDueDate: data.paymentDueDate
          ? new Date(data.paymentDueDate)
          : null,
        expectedPaymentDate: data.expectedPaymentDate
          ? new Date(data.expectedPaymentDate)
          : data.paymentDueDate
          ? new Date(data.paymentDueDate)
          : null,
        subtotal,
        taxAmount,
        totalAmount,
        projectId: stpProjectId,
        status: "draft",
        createdBy: user.id,
      },
    });

    // 取引をグループに紐づけ（projectIdでスコープ）
    await tx.transaction.updateMany({
      where: { id: { in: transactions.map((t) => t.id) }, projectId: stpProjectId },
      data: { invoiceGroupId: group.id },
    });

    return { id: group.id, invoiceNumber: null };
  });

  revalidatePath("/stp/finance/invoices");
  revalidatePath("/stp/finance/transactions");
  return result;
}

// ============================================
// 更新
// ============================================

export async function updateInvoiceGroup(
  id: number,
  data: {
    bankAccountId?: number | null;
    invoiceDate?: string | null;
    paymentDueDate?: string | null;
    expectedPaymentDate?: string | null;
    actualPaymentDate?: string | null;
    subtotal?: number | null;
    taxAmount?: number | null;
    totalAmount?: number | null;
  }
): Promise<void> {
  const user = await requireEdit("stp");
  const stpProjectId = await requireStpProjectId();

  const group = await prisma.invoiceGroup.findUnique({
    where: { id, deletedAt: null, projectId: stpProjectId },
  });
  if (!group) throw new Error("請求が見つかりません");

  // actualPaymentDate のみの更新は送付済み以降でも許可
  const onlyActualPaymentDate =
    Object.keys(data).length === 1 && "actualPaymentDate" in data;

  // 送付済み以降・返送は編集不可（actualPaymentDateのみは例外）
  if (
    !onlyActualPaymentDate &&
    ["sent", "awaiting_accounting", "partially_paid", "paid", "corrected", "returned"].includes(group.status)
  ) {
    throw new Error("このステータスでは編集できません");
  }

  const updateData: Record<string, unknown> = {
    updatedBy: user.id,
  };

  if ("bankAccountId" in data)
    updateData.bankAccountId = data.bankAccountId ?? null;
  if ("invoiceDate" in data)
    updateData.invoiceDate = data.invoiceDate
      ? new Date(data.invoiceDate)
      : null;
  if ("paymentDueDate" in data)
    updateData.paymentDueDate = data.paymentDueDate
      ? new Date(data.paymentDueDate)
      : null;
  if ("expectedPaymentDate" in data)
    updateData.expectedPaymentDate = data.expectedPaymentDate
      ? new Date(data.expectedPaymentDate)
      : null;
  if ("actualPaymentDate" in data)
    updateData.actualPaymentDate = data.actualPaymentDate
      ? new Date(data.actualPaymentDate)
      : null;
  if ("subtotal" in data) updateData.subtotal = data.subtotal;
  if ("taxAmount" in data) updateData.taxAmount = data.taxAmount;
  if ("totalAmount" in data) updateData.totalAmount = data.totalAmount;

  // pdf_created状態で情報が変更された場合、ステータスをdraftに戻す
  if (group.status === "pdf_created") {
    updateData.pdfPath = null;
    updateData.pdfFileName = null;
    updateData.status = "draft";
  }

  await prisma.invoiceGroup.update({
    where: { id },
    data: updateData,
  });

  revalidatePath("/stp/finance/invoices");
}

// ============================================
// 取引の追加・削除
// ============================================

export async function addTransactionToGroup(
  groupId: number,
  transactionIds: number[]
): Promise<void> {
  const user = await requireEdit("stp");
  const stpProjectId = await requireStpProjectId();

  const group = await prisma.invoiceGroup.findUnique({
    where: { id: groupId, deletedAt: null, projectId: stpProjectId },
    include: { transactions: { where: { deletedAt: null } } },
  });
  if (!group) throw new Error("請求が見つかりません");

  // 下書き・PDF作成済みのみ追加可能
  if (!["draft", "pdf_created"].includes(group.status)) {
    throw new Error("このステータスでは取引を追加できません");
  }

  // P1-1: 按分取引は direct FK ルートでは追加不可
  const allocationTx = await prisma.transaction.findFirst({
    where: {
      id: { in: transactionIds },
      allocationTemplateId: { not: null },
      deletedAt: null,
    },
  });
  if (allocationTx) {
    throw new Error("按分取引は直接請求に所属できません。按分明細として追加してください。");
  }

  // 追加する取引を検証（projectIdでスコープ）
  const transactions = await prisma.transaction.findMany({
    where: {
      id: { in: transactionIds },
      deletedAt: null,
      status: "confirmed",
      invoiceGroupId: null,
      type: "revenue",
      counterpartyId: group.counterpartyId,
      projectId: stpProjectId,
    },
  });

  if (transactions.length === 0) {
    throw new Error("追加できる取引がありません");
  }

  // 部分成功を防止: 入力IDと取得IDが完全一致することを検証
  if (transactions.length !== transactionIds.length) {
    throw new Error(
      `指定された${transactionIds.length}件のうち${transactions.length}件しか対象外です。ステータス・プロジェクトを確認してください`
    );
  }

  await prisma.$transaction(async (tx) => {
    // 取引をグループに紐づけ（projectIdでスコープ）
    await tx.transaction.updateMany({
      where: { id: { in: transactions.map((t) => t.id) }, projectId: stpProjectId },
      data: { invoiceGroupId: groupId },
    });

    // 金額再計算（単純合計）
    const allTransactions = [
      ...group.transactions,
      ...transactions,
    ];
    const { subtotal, taxAmount, totalAmount } = calcGroupTotals(allTransactions);

    const updateData: Record<string, unknown> = {
      subtotal,
      taxAmount,
      totalAmount,
      updatedBy: user.id,
    };

    // pdf_created時はPDFを無効化
    if (group.status === "pdf_created") {
      updateData.pdfPath = null;
      updateData.pdfFileName = null;
      updateData.status = "draft";
    }

    await tx.invoiceGroup.update({
      where: { id: groupId },
      data: updateData,
    });
  });

  revalidatePath("/stp/finance/invoices");
  revalidatePath("/stp/finance/transactions");
}

export async function removeTransactionFromGroup(
  groupId: number,
  transactionId: number
): Promise<void> {
  const user = await requireEdit("stp");
  const stpProjectId = await requireStpProjectId();

  const group = await prisma.invoiceGroup.findUnique({
    where: { id: groupId, deletedAt: null, projectId: stpProjectId },
    include: { transactions: { where: { deletedAt: null } } },
  });
  if (!group) throw new Error("請求が見つかりません");

  // 下書き・PDF作成済みのみ削除可能
  if (!["draft", "pdf_created"].includes(group.status)) {
    throw new Error("このステータスでは取引を削除できません");
  }

  await prisma.$transaction(async (tx) => {
    // 取引のグループ紐付けを解除（所属グループ+projectIdを検証）
    await tx.transaction.update({
      where: { id: transactionId, invoiceGroupId: groupId, projectId: stpProjectId },
      data: { invoiceGroupId: null },
    });

    // 金額再計算（単純合計）
    const remaining = group.transactions.filter(
      (t) => t.id !== transactionId
    );
    const { subtotal, taxAmount, totalAmount } = calcGroupTotals(remaining);

    const updateData: Record<string, unknown> = {
      subtotal,
      taxAmount,
      totalAmount,
      updatedBy: user.id,
    };

    // pdf_created時はPDFを無効化
    if (group.status === "pdf_created") {
      updateData.pdfPath = null;
      updateData.pdfFileName = null;
      updateData.status = "draft";
    }

    await tx.invoiceGroup.update({
      where: { id: groupId },
      data: updateData,
    });
  });

  revalidatePath("/stp/finance/invoices");
  revalidatePath("/stp/finance/transactions");
}

// ============================================
// 削除（論理削除）
// ============================================

export async function deleteInvoiceGroup(
  id: number,
  deleteTransactions?: boolean
): Promise<void> {
  const user = await requireEdit("stp");
  const stpProjectId = await requireStpProjectId();

  const group = await prisma.invoiceGroup.findUnique({
    where: { id, deletedAt: null, projectId: stpProjectId },
  });
  if (!group) throw new Error("請求が見つかりません");

  // 下書き・PDF作成済みのみ削除可能
  if (!["draft", "pdf_created"].includes(group.status)) {
    throw new Error("下書きまたはPDF作成済みの請求のみ削除できます");
  }

  await prisma.$transaction(async (tx) => {
    if (deleteTransactions) {
      // 取引も論理削除（projectIdでスコープ）
      await tx.transaction.updateMany({
        where: { invoiceGroupId: id, deletedAt: null, projectId: stpProjectId },
        data: { deletedAt: new Date(), invoiceGroupId: null },
      });
    } else {
      // 取引のグループ紐付けを解除（projectIdでスコープ）
      await tx.transaction.updateMany({
        where: { invoiceGroupId: id, projectId: stpProjectId },
        data: { invoiceGroupId: null },
      });
    }

    // 論理削除
    await tx.invoiceGroup.update({
      where: { id },
      data: { deletedAt: new Date(), updatedBy: user.id },
    });
  });

  revalidatePath("/stp/finance/invoices");
  revalidatePath("/stp/finance/transactions");
}

// ============================================
// 訂正請求書の作成
// ============================================

export async function createCorrectionInvoiceGroup(
  originalId: number,
  correctionType: "replacement" | "additional"
): Promise<{ id: number }> {
  const user = await requireEdit("stp");
  const stpProjectId = await requireStpProjectId();

  const original = await prisma.invoiceGroup.findUnique({
    where: { id: originalId, deletedAt: null, projectId: stpProjectId },
    include: { transactions: { where: { deletedAt: null } } },
  });
  if (!original) throw new Error("元の請求が見つかりません");

  // 送付済み以降のみ訂正可能
  if (!["sent", "awaiting_accounting"].includes(original.status)) {
    throw new Error("送付済みまたは経理処理待ちの請求のみ訂正できます");
  }

  const result = await prisma.$transaction(async (tx) => {
    // 訂正請求書を作成（元の請求のprojectIdを継承）
    const correction = await tx.invoiceGroup.create({
      data: {
        counterpartyId: original.counterpartyId,
        operatingCompanyId: original.operatingCompanyId,
        bankAccountId: original.bankAccountId,
        invoiceDate: null,
        paymentDueDate: original.paymentDueDate,
        originalInvoiceGroupId: originalId,
        correctionType,
        projectId: original.projectId ?? null,
        status: "draft",
        createdBy: user.id,
      },
    });

    // 差し替えの場合: 元の取引を新しいグループに移動（projectIdでスコープ）
    if (correctionType === "replacement") {
      await tx.transaction.updateMany({
        where: { id: { in: original.transactions.map((t) => t.id) }, projectId: stpProjectId },
        data: { invoiceGroupId: correction.id },
      });

      // 金額を引き継ぎ
      await tx.invoiceGroup.update({
        where: { id: correction.id },
        data: {
          subtotal: original.subtotal,
          taxAmount: original.taxAmount,
          totalAmount: original.totalAmount,
        },
      });
    }

    // 元の請求グループを「訂正済み」に
    await tx.invoiceGroup.update({
      where: { id: originalId },
      data: {
        status: "corrected",
        updatedBy: user.id,
      },
    });

    return { id: correction.id };
  });

  revalidatePath("/stp/finance/invoices");
  revalidatePath("/stp/finance/transactions");
  return result;
}

// ============================================
// 請求書番号の採番（PDF作成時）
// ============================================

export async function assignInvoiceNumber(
  groupId: number
): Promise<string> {
  const user = await requireEdit("stp");
  const stpProjectId = await requireStpProjectId();

  const result = await prisma.$transaction(async (tx) => {
    const group = await tx.invoiceGroup.findUnique({
      where: { id: groupId, deletedAt: null, projectId: stpProjectId },
    });
    if (!group) throw new Error("請求が見つかりません");

    // 既に採番済みならそのまま返す
    if (group.invoiceNumber) return group.invoiceNumber;

    const invoiceNumber = await generateInvoiceGroupNumber(
      group.operatingCompanyId,
      tx
    );

    const oldStatus = group.status;
    await tx.invoiceGroup.update({
      where: { id: groupId },
      data: {
        invoiceNumber,
        status: "pdf_created",
        updatedBy: user.id,
      },
    });

    await recordChangeLog(
      {
        tableName: "InvoiceGroup",
        recordId: groupId,
        changeType: "update",
        oldData: { status: oldStatus },
        newData: { status: "pdf_created" },
      },
      user.id,
      tx
    );

    return invoiceNumber;
  });

  revalidatePath("/stp/finance/invoices");
  return result;
}

// ============================================
// ステータス変更
// ============================================

export async function updateInvoiceGroupStatus(
  id: number,
  newStatus: string
): Promise<void> {
  const user = await requireEdit("stp");
  const stpProjectId = await requireStpProjectId();

  const group = await prisma.invoiceGroup.findUnique({
    where: { id, deletedAt: null, projectId: stpProjectId },
  });
  if (!group) throw new Error("請求が見つかりません");

  // 遷移バリデーション
  const validTransitions: Record<string, string[]> = {
    draft: ["pdf_created"],
    pdf_created: ["draft", "sent"],
    sent: ["awaiting_accounting", "corrected"],
    awaiting_accounting: ["partially_paid", "paid", "returned", "corrected"],
    partially_paid: ["paid"],
    returned: ["draft"],
  };

  const allowed = validTransitions[group.status] ?? [];
  if (!allowed.includes(newStatus)) {
    throw new Error(
      `ステータスを「${group.status}」から「${newStatus}」に変更できません`
    );
  }

  // pdf_created への遷移時に採番
  if (newStatus === "pdf_created" && !group.invoiceNumber) {
    await assignInvoiceNumber(id);
    return;
  }

  const oldStatus = group.status;
  await prisma.$transaction(async (tx) => {
    await tx.invoiceGroup.update({
      where: { id },
      data: { status: newStatus, updatedBy: user.id },
    });

    await recordChangeLog(
      {
        tableName: "InvoiceGroup",
        recordId: id,
        changeType: "update",
        oldData: { status: oldStatus },
        newData: { status: newStatus },
      },
      user.id,
      tx
    );
  });

  revalidatePath("/stp/finance/invoices");
}

// ============================================
// 金額再計算（取引追加・削除後）
// ============================================

export async function recalcInvoiceGroupTotals(
  groupId: number
): Promise<void> {
  const user = await requireEdit("stp");
  const stpProjectId = await requireStpProjectId();

  const group = await prisma.invoiceGroup.findUnique({
    where: { id: groupId, deletedAt: null, projectId: stpProjectId },
    include: { transactions: { where: { deletedAt: null } } },
  });
  if (!group) throw new Error("請求が見つかりません");

  // 取引の税額を単純合計
  const { subtotal, taxAmount, totalAmount } = calcGroupTotals(group.transactions);

  await prisma.invoiceGroup.update({
    where: { id: groupId },
    data: {
      subtotal,
      taxAmount,
      totalAmount,
      updatedBy: user.id,
    },
  });

  revalidatePath("/stp/finance/invoices");
}

// ============================================
// PDF生成・保存
// ============================================

export async function generateInvoicePdf(
  groupId: number
): Promise<{ pdfPath: string; invoiceNumber: string }> {
  const user = await requireEdit("stp");
  const stpProjectId = await requireStpProjectId();

  // 動的importでサーバー専用モジュールを遅延ロード
  const { getInvoicePdfData, generateInvoicePdfBuffer } = await import(
    "@/lib/invoices/pdf-generator"
  );

  const result = await prisma.$transaction(async (tx) => {
    const group = await tx.invoiceGroup.findUnique({
      where: { id: groupId, deletedAt: null, projectId: stpProjectId },
    });
    if (!group) throw new Error("請求が見つかりません");

    // draft または pdf_created のみPDF生成可能
    if (!["draft", "pdf_created"].includes(group.status)) {
      throw new Error("このステータスではPDFを生成できません");
    }

    // 請求書番号を採番（未採番の場合）
    let invoiceNumber = group.invoiceNumber;
    if (!invoiceNumber) {
      invoiceNumber = await generateInvoiceGroupNumber(
        group.operatingCompanyId,
        tx
      );
      await tx.invoiceGroup.update({
        where: { id: groupId },
        data: { invoiceNumber },
      });
    }

    return { invoiceNumber, operatingCompanyId: group.operatingCompanyId };
  });

  // PDF生成（トランザクション外: DB読取のみ、projectIdでスコープ）
  const data = await getInvoicePdfData(groupId, stpProjectId);
  // 採番済み番号を反映
  data.invoiceNumber = result.invoiceNumber;

  const buffer = await generateInvoicePdfBuffer(data);

  // ファイル保存
  const now = new Date();
  const yearMonth = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, "0")}`;
  const uploadDir = path.join(
    process.cwd(),
    "public/uploads/invoices",
    yearMonth
  );
  await fs.mkdir(uploadDir, { recursive: true });

  const pdfFileName = `invoice-${groupId}-${Date.now()}.pdf`;
  const filePath = path.join(uploadDir, pdfFileName);
  const publicPath = `/uploads/invoices/${yearMonth}/${pdfFileName}`;

  await fs.writeFile(filePath, buffer);

  // DB更新: pdfPath, pdfFileName, status
  const displayFileName = `請求書_${result.invoiceNumber}.pdf`;
  await prisma.invoiceGroup.update({
    where: { id: groupId },
    data: {
      pdfPath: publicPath,
      pdfFileName: displayFileName,
      status: "pdf_created",
      updatedBy: user.id,
    },
  });

  revalidatePath("/stp/finance/invoices");
  return { pdfPath: publicPath, invoiceNumber: result.invoiceNumber };
}

// ============================================
// 経理へ引渡
// ============================================

export async function submitInvoiceGroupToAccounting(
  id: number
): Promise<void> {
  const user = await requireEdit("stp");
  const stpProjectId = await requireStpProjectId();

  const group = await prisma.invoiceGroup.findUnique({
    where: { id, deletedAt: null, projectId: stpProjectId },
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
  if (!group) throw new Error("請求が見つかりません");

  if (group.status !== "sent") {
    throw new Error("送付済みの請求のみ経理へ引き渡せます");
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

  const oldStatus = group.status;
  await prisma.$transaction(async (tx) => {
    await tx.invoiceGroup.update({
      where: { id },
      data: { status: "awaiting_accounting", updatedBy: user.id },
    });

    await recordChangeLog(
      {
        tableName: "InvoiceGroup",
        recordId: id,
        changeType: "update",
        oldData: { status: oldStatus },
        newData: { status: "awaiting_accounting" },
      },
      user.id,
      tx
    );
  });

  revalidatePath("/stp/finance/invoices");
}

// ============================================
// 証憑管理
// ============================================

export async function getInvoiceGroupAttachments(groupId: number) {
  await requireEdit("stp");
  const attachments = await prisma.attachment.findMany({
    where: { invoiceGroupId: groupId, deletedAt: null },
    orderBy: { createdAt: "desc" },
  });
  return attachments.map((a) => ({
    id: a.id,
    fileName: a.fileName,
    filePath: a.filePath,
    fileSize: a.fileSize,
    mimeType: a.mimeType,
    createdAt: a.createdAt.toISOString(),
  }));
}

export async function addInvoiceGroupAttachments(
  groupId: number,
  files: { filePath: string; fileName: string; fileSize: number; mimeType: string }[]
) {
  const session = await requireEdit("stp");
  await prisma.attachment.createMany({
    data: files.map((f) => ({
      invoiceGroupId: groupId,
      filePath: f.filePath,
      fileName: f.fileName,
      fileSize: f.fileSize,
      mimeType: f.mimeType,
      attachmentType: "voucher",
      uploadedBy: session.id,
    })),
  });
  revalidatePath("/stp/finance/invoices");
}

export async function deleteInvoiceGroupAttachment(attachmentId: number) {
  await requireEdit("stp");
  await prisma.attachment.update({
    where: { id: attachmentId },
    data: { deletedAt: new Date() },
  });
  revalidatePath("/stp/finance/invoices");
}

// ============================================
// 未確定取引（取引先別）
// ============================================

export async function getUnconfirmedTransactions(
  projectId?: number
): Promise<UngroupedTransaction[]> {
  const records = await prisma.transaction.findMany({
    where: {
      deletedAt: null,
      type: "revenue",
      status: "unconfirmed",
      ...(projectId ? { projectId } : {}),
    },
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
