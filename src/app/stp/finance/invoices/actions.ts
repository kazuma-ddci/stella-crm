"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { requireEdit } from "@/lib/auth";
import { generateInvoiceGroupNumber } from "@/lib/finance/invoice-number";
import { recordChangeLog } from "@/app/accounting/changelog/actions";
import { calcInvoiceTaxSummary, calcInvoiceTotalFromSummary } from "@/lib/finance/invoice-tax";
import fs from "fs/promises";
import path from "path";

// ============================================
// 税額計算ヘルパー（仕様9.1準拠: 税率別グループ小計→一括税額計算）
// ============================================

function calcGroupTotals(transactions: { amount: number; taxAmount: number; taxRate: number; taxType: string }[]) {
  const lineItems = transactions.map((t) => ({
    amount: t.taxType === "tax_excluded" ? t.amount : t.amount - t.taxAmount,
    taxRate: t.taxRate,
  }));
  const taxSummary = calcInvoiceTaxSummary(lineItems);
  const { totalAmount, taxAmount } = calcInvoiceTotalFromSummary(taxSummary);
  return { subtotal: totalAmount - taxAmount, taxAmount, totalAmount };
}

// ============================================
// 型定義
// ============================================

export type InvoiceGroupListItem = {
  id: number;
  counterpartyId: number;
  counterpartyName: string;
  operatingCompanyId: number;
  operatingCompanyName: string;
  bankAccountId: number | null;
  bankAccountLabel: string | null;
  invoiceNumber: string | null;
  invoiceDate: string | null;
  paymentDueDate: string | null;
  subtotal: number | null;
  taxAmount: number | null;
  totalAmount: number | null;
  pdfPath: string | null;
  status: string;
  correctionType: string | null;
  originalInvoiceGroupId: number | null;
  originalInvoiceNumber: string | null;
  transactionCount: number;
  createdByName: string;
  createdAt: string;
};

export type UngroupedTransaction = {
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

export async function getInvoiceGroups(): Promise<InvoiceGroupListItem[]> {
  const records = await prisma.invoiceGroup.findMany({
    where: { deletedAt: null },
    include: {
      counterparty: true,
      operatingCompany: true,
      bankAccount: true,
      originalInvoiceGroup: { select: { invoiceNumber: true } },
      transactions: { where: { deletedAt: null }, select: { id: true } },
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
    subtotal: r.subtotal,
    taxAmount: r.taxAmount,
    totalAmount: r.totalAmount,
    pdfPath: r.pdfPath,
    status: r.status,
    correctionType: r.correctionType,
    originalInvoiceGroupId: r.originalInvoiceGroupId,
    originalInvoiceNumber: r.originalInvoiceGroup?.invoiceNumber ?? null,
    transactionCount: r.transactions.length,
    createdByName: r.creator.name,
    createdAt: r.createdAt.toISOString().split("T")[0],
  }));
}

// 確認済み＆未グループ化の売上取引を取得
export async function getUngroupedTransactions(
  counterpartyId?: number
): Promise<UngroupedTransaction[]> {
  const where: Record<string, unknown> = {
    deletedAt: null,
    type: "revenue",
    status: "confirmed",
    invoiceGroupId: null,
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

export async function createInvoiceGroup(data: {
  counterpartyId: number;
  operatingCompanyId: number;
  bankAccountId?: number | null;
  invoiceDate?: string | null;
  paymentDueDate?: string | null;
  transactionIds: number[];
}): Promise<{ id: number; invoiceNumber: string | null }> {
  const user = await requireEdit("stp");

  const result = await prisma.$transaction(async (tx) => {
    // 選択された取引の金額を集計
    const transactions = await tx.transaction.findMany({
      where: {
        id: { in: data.transactionIds },
        deletedAt: null,
        status: "confirmed",
        invoiceGroupId: null,
        type: "revenue",
      },
    });

    if (transactions.length === 0) {
      throw new Error("グループ化できる取引がありません");
    }

    // 全取引が同一取引先か確認
    const counterpartyIds = new Set(transactions.map((t) => t.counterpartyId));
    if (counterpartyIds.size > 1) {
      throw new Error("異なる取引先の取引は同じ請求グループに入れられません");
    }
    if (!counterpartyIds.has(data.counterpartyId)) {
      throw new Error("取引先が一致しません");
    }

    // 金額計算（仕様9.1準拠: 税率別グループ小計→一括税額計算）
    const { subtotal, taxAmount, totalAmount } = calcGroupTotals(transactions);

    // InvoiceGroup作成
    const group = await tx.invoiceGroup.create({
      data: {
        counterpartyId: data.counterpartyId,
        operatingCompanyId: data.operatingCompanyId,
        bankAccountId: data.bankAccountId ?? null,
        invoiceDate: data.invoiceDate ? new Date(data.invoiceDate) : null,
        paymentDueDate: data.paymentDueDate
          ? new Date(data.paymentDueDate)
          : null,
        subtotal,
        taxAmount,
        totalAmount,
        status: "draft",
        createdBy: user.id,
      },
    });

    // 取引をグループに紐づけ
    await tx.transaction.updateMany({
      where: { id: { in: data.transactionIds } },
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
    subtotal?: number | null;
    taxAmount?: number | null;
    totalAmount?: number | null;
  }
): Promise<void> {
  const user = await requireEdit("stp");

  const group = await prisma.invoiceGroup.findUnique({
    where: { id, deletedAt: null },
  });
  if (!group) throw new Error("請求グループが見つかりません");

  // 送付済み以降・返送は編集不可（returnedはdraftに戻してから編集）
  if (["sent", "awaiting_accounting", "partially_paid", "paid", "corrected", "returned"].includes(group.status)) {
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

  const group = await prisma.invoiceGroup.findUnique({
    where: { id: groupId, deletedAt: null },
    include: { transactions: { where: { deletedAt: null } } },
  });
  if (!group) throw new Error("請求グループが見つかりません");

  // 下書き・PDF作成済みのみ追加可能
  if (!["draft", "pdf_created"].includes(group.status)) {
    throw new Error("このステータスでは取引を追加できません");
  }

  // 追加する取引を検証
  const transactions = await prisma.transaction.findMany({
    where: {
      id: { in: transactionIds },
      deletedAt: null,
      status: "confirmed",
      invoiceGroupId: null,
      type: "revenue",
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
      data: { invoiceGroupId: groupId },
    });

    // 金額再計算（仕様9.1準拠）
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

  const group = await prisma.invoiceGroup.findUnique({
    where: { id: groupId, deletedAt: null },
    include: { transactions: { where: { deletedAt: null } } },
  });
  if (!group) throw new Error("請求グループが見つかりません");

  // 下書き・PDF作成済みのみ削除可能
  if (!["draft", "pdf_created"].includes(group.status)) {
    throw new Error("このステータスでは取引を削除できません");
  }

  await prisma.$transaction(async (tx) => {
    // 取引のグループ紐付けを解除（所属グループを検証）
    await tx.transaction.update({
      where: { id: transactionId, invoiceGroupId: groupId },
      data: { invoiceGroupId: null },
    });

    // 金額再計算（仕様9.1準拠）
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

export async function deleteInvoiceGroup(id: number): Promise<void> {
  const user = await requireEdit("stp");

  const group = await prisma.invoiceGroup.findUnique({
    where: { id, deletedAt: null },
  });
  if (!group) throw new Error("請求グループが見つかりません");

  // 下書きのみ削除可能
  if (group.status !== "draft") {
    throw new Error("下書きステータスの請求グループのみ削除できます");
  }

  await prisma.$transaction(async (tx) => {
    // 取引のグループ紐付けを解除
    await tx.transaction.updateMany({
      where: { invoiceGroupId: id },
      data: { invoiceGroupId: null },
    });

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

  const original = await prisma.invoiceGroup.findUnique({
    where: { id: originalId, deletedAt: null },
    include: { transactions: { where: { deletedAt: null } } },
  });
  if (!original) throw new Error("元の請求グループが見つかりません");

  // 送付済み以降のみ訂正可能
  if (!["sent", "awaiting_accounting"].includes(original.status)) {
    throw new Error("送付済みまたは経理処理待ちの請求グループのみ訂正できます");
  }

  const result = await prisma.$transaction(async (tx) => {
    // 訂正請求書を作成
    const correction = await tx.invoiceGroup.create({
      data: {
        counterpartyId: original.counterpartyId,
        operatingCompanyId: original.operatingCompanyId,
        bankAccountId: original.bankAccountId,
        invoiceDate: null,
        paymentDueDate: original.paymentDueDate,
        originalInvoiceGroupId: originalId,
        correctionType,
        status: "draft",
        createdBy: user.id,
      },
    });

    // 差し替えの場合: 元の取引を新しいグループに移動
    if (correctionType === "replacement") {
      await tx.transaction.updateMany({
        where: { id: { in: original.transactions.map((t) => t.id) } },
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

  const result = await prisma.$transaction(async (tx) => {
    const group = await tx.invoiceGroup.findUnique({
      where: { id: groupId, deletedAt: null },
    });
    if (!group) throw new Error("請求グループが見つかりません");

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

  const group = await prisma.invoiceGroup.findUnique({
    where: { id, deletedAt: null },
  });
  if (!group) throw new Error("請求グループが見つかりません");

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

  const group = await prisma.invoiceGroup.findUnique({
    where: { id: groupId, deletedAt: null },
    include: { transactions: { where: { deletedAt: null } } },
  });
  if (!group) throw new Error("請求グループが見つかりません");

  // 仕様9.1準拠: 税率別にグループ小計→一括税額計算（インボイス制度対応）
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

  // 動的importでサーバー専用モジュールを遅延ロード
  const { getInvoicePdfData, generateInvoicePdfBuffer } = await import(
    "@/lib/invoices/pdf-generator"
  );

  const result = await prisma.$transaction(async (tx) => {
    const group = await tx.invoiceGroup.findUnique({
      where: { id: groupId, deletedAt: null },
    });
    if (!group) throw new Error("請求グループが見つかりません");

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

  // PDF生成（トランザクション外: DB読取のみ）
  const data = await getInvoicePdfData(groupId);
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
