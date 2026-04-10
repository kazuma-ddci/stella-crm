"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { requireEdit } from "@/lib/auth";
import { generateInvoiceGroupNumber } from "@/lib/finance/invoice-number";
import { recordChangeLog } from "@/app/accounting/changelog/actions";
import { requireStpProjectId } from "@/lib/project-context";
import fs from "fs/promises";
import path from "path";
import { formatTimestamp } from "@/lib/attachments/constants";
import { toLocalDateString } from "@/lib/utils";
import { calcDueDate } from "@/lib/finance/due-date";
import { createNotificationBulk } from "@/lib/notifications/create-notification";
import { createCounterpartyForCompany } from "@/lib/counterparty-sync";
import { syncPaymentDateToRevenueRecords } from "@/lib/accounting/sync-payment-date";

// ============================================
// 税額計算ヘルパー（グループレベル一括計算）
// インボイス制度対応: 税率ごとに集計し端数処理は税率グループ単位で1回のみ
// ============================================

import { calcInvoiceTaxSummary, calcInvoiceTotalFromSummary } from "@/lib/finance/invoice-tax";

function calcGroupTotals(transactions: { amount: number; taxAmount: number; taxRate: number; taxType: string }[]) {
  // 各取引の税抜金額を算出（knownTaxでDB保存済み税額をパススルーし¥1ズレを防ぐ）
  const lineItems = transactions.map((t) => ({
    amount: t.taxType === "tax_excluded" ? t.amount : t.amount - t.taxAmount,
    taxRate: t.taxRate,
    knownTax: t.taxAmount,
  }));

  const summary = calcInvoiceTaxSummary(lineItems);
  const { totalAmount, taxAmount } = calcInvoiceTotalFromSummary(summary);
  const subtotal = totalAmount - taxAmount;

  return { subtotal, taxAmount, totalAmount };
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
      transactions: { where: { deletedAt: null }, select: { id: true, counterpartyId: true }, take: 1 },
      allocationItems: { select: { id: true } },
      creator: true,
      receipts: {
        orderBy: { receivedDate: "asc" },
        include: { creator: { select: { name: true } } },
      },
      _count: { select: { memoLines: true, transactions: { where: { deletedAt: null } } } },
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
  });

  // 宛先変更されている請求書の元取引先名を一括取得
  const redirectedCounterpartyIds = new Set<number>();
  for (const r of records) {
    const txCpId = r.transactions[0]?.counterpartyId;
    if (txCpId && txCpId !== r.counterpartyId) {
      redirectedCounterpartyIds.add(txCpId);
    }
  }
  const originalCpMap = new Map<number, string>();
  if (redirectedCounterpartyIds.size > 0) {
    const cps = await prisma.counterparty.findMany({
      where: { id: { in: [...redirectedCounterpartyIds] } },
      select: { id: true, name: true },
    });
    for (const cp of cps) {
      originalCpMap.set(cp.id, cp.name);
    }
  }

  return records.map((r) => {
    const txCpId = r.transactions[0]?.counterpartyId ?? null;
    const isRedirected = txCpId !== null && txCpId !== r.counterpartyId;
    const receiptTotal = r.receipts.reduce((sum, x) => sum + x.amount, 0);
    const receiptStatus: "none" | "partial" | "complete" | "over" =
      r.receipts.length === 0
        ? "none"
        : receiptTotal === (r.totalAmount ?? 0)
          ? "complete"
          : receiptTotal < (r.totalAmount ?? 0)
            ? "partial"
            : "over";
    return {
    id: r.id,
    counterpartyId: r.counterpartyId,
    counterpartyName: r.counterparty.name,
    originalCounterpartyName: isRedirected ? (originalCpMap.get(txCpId) ?? null) : null,
    operatingCompanyId: r.operatingCompanyId,
    operatingCompanyName: r.operatingCompany.companyName,
    bankAccountId: r.bankAccountId,
    bankAccountLabel: r.bankAccount
      ? `${r.bankAccount.bankName} ${r.bankAccount.branchName} ${r.bankAccount.accountNumber}`
      : null,
    invoiceNumber: r.invoiceNumber,
    invoiceDate: r.invoiceDate ? toLocalDateString(r.invoiceDate) : null,
    paymentDueDate: r.paymentDueDate ? toLocalDateString(r.paymentDueDate) : null,
    expectedPaymentDate: r.expectedPaymentDate ? toLocalDateString(r.expectedPaymentDate) : null,
    actualPaymentDate: r.actualPaymentDate ? toLocalDateString(r.actualPaymentDate) : null,
    subtotal: r.subtotal,
    taxAmount: r.taxAmount,
    totalAmount: r.totalAmount,
    pdfPath: r.pdfPath,
    status: r.status,
    correctionType: r.correctionType,
    originalInvoiceGroupId: r.originalInvoiceGroupId,
    originalInvoiceNumber: r.originalInvoiceGroup?.invoiceNumber ?? null,
    honorific: r.honorific,
    remarks: r.remarks,
    lineOrder: r.lineOrder as string[] | null,
    memoLineCount: r._count.memoLines,
    transactionCount: r._count.transactions,
    allocationItemCount: r.allocationItems.length,
    createdByName: r.creator.name,
    createdAt: toLocalDateString(r.createdAt),
    receipts: r.receipts.map((x) => ({
      id: x.id,
      receivedDate: toLocalDateString(x.receivedDate),
      amount: x.amount,
      comment: x.comment,
      createdByName: x.creator.name,
      isBankLinked: x.bankTransactionLinkId !== null,
    })),
    receiptStatus,
    receiptTotal,
    manualPaymentStatus: r.manualPaymentStatus as "unpaid" | "partial" | "completed",
  };
  });
}

// 単一の請求グループを取得
export async function getInvoiceGroupById(
  groupId: number
): Promise<InvoiceGroupListItem | null> {
  const r = await prisma.invoiceGroup.findFirst({
    where: { id: groupId, deletedAt: null },
    include: {
      counterparty: true,
      operatingCompany: true,
      bankAccount: true,
      originalInvoiceGroup: { select: { invoiceNumber: true } },
      transactions: { where: { deletedAt: null }, select: { id: true, counterpartyId: true } },
      allocationItems: { select: { id: true } },
      creator: true,
      receipts: {
        orderBy: { receivedDate: "asc" },
        include: { creator: { select: { name: true } } },
      },
      _count: { select: { memoLines: true } },
    },
  });
  if (!r) return null;

  // 宛先変更の判定
  const txCpId = r.transactions[0]?.counterpartyId ?? null;
  const isRedirected = txCpId !== null && txCpId !== r.counterpartyId;
  let origCpName: string | null = null;
  if (isRedirected) {
    const origCp = await prisma.counterparty.findUnique({
      where: { id: txCpId },
      select: { name: true },
    });
    origCpName = origCp?.name ?? null;
  }

  const receiptTotal = r.receipts.reduce((sum, x) => sum + x.amount, 0);
  const receiptStatus: "none" | "partial" | "complete" | "over" =
    r.receipts.length === 0
      ? "none"
      : receiptTotal === (r.totalAmount ?? 0)
        ? "complete"
        : receiptTotal < (r.totalAmount ?? 0)
          ? "partial"
          : "over";

  return {
    id: r.id,
    counterpartyId: r.counterpartyId,
    counterpartyName: r.counterparty.name,
    originalCounterpartyName: origCpName,
    operatingCompanyId: r.operatingCompanyId,
    operatingCompanyName: r.operatingCompany.companyName,
    bankAccountId: r.bankAccountId,
    bankAccountLabel: r.bankAccount
      ? `${r.bankAccount.bankName} ${r.bankAccount.branchName} ${r.bankAccount.accountNumber}`
      : null,
    invoiceNumber: r.invoiceNumber,
    invoiceDate: r.invoiceDate ? toLocalDateString(r.invoiceDate) : null,
    paymentDueDate: r.paymentDueDate ? toLocalDateString(r.paymentDueDate) : null,
    expectedPaymentDate: r.expectedPaymentDate ? toLocalDateString(r.expectedPaymentDate) : null,
    actualPaymentDate: r.actualPaymentDate ? toLocalDateString(r.actualPaymentDate) : null,
    subtotal: r.subtotal,
    taxAmount: r.taxAmount,
    totalAmount: r.totalAmount,
    pdfPath: r.pdfPath,
    status: r.status,
    correctionType: r.correctionType,
    originalInvoiceGroupId: r.originalInvoiceGroupId,
    originalInvoiceNumber: r.originalInvoiceGroup?.invoiceNumber ?? null,
    honorific: r.honorific,
    remarks: r.remarks,
    lineOrder: r.lineOrder as string[] | null,
    memoLineCount: r._count.memoLines,
    transactionCount: r.transactions.length,
    allocationItemCount: r.allocationItems.length,
    createdByName: r.creator.name,
    createdAt: toLocalDateString(r.createdAt),
    receipts: r.receipts.map((x) => ({
      id: x.id,
      receivedDate: toLocalDateString(x.receivedDate),
      amount: x.amount,
      comment: x.comment,
      createdByName: x.creator.name,
      isBankLinked: x.bankTransactionLinkId !== null,
    })),
    receiptStatus,
    receiptTotal,
    manualPaymentStatus: r.manualPaymentStatus as "unpaid" | "partial" | "completed",
  };
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
    expenseCategoryName: r.expenseCategory?.name ?? "（未設定）",
    amount: r.amount,
    taxAmount: r.taxAmount,
    taxRate: r.taxRate,
    taxType: r.taxType,
    periodFrom: toLocalDateString(r.periodFrom),
    periodTo: toLocalDateString(r.periodTo),
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
        expenseCategoryName: tx.expenseCategory?.name ?? "（未設定）",
        costCenterId: line.costCenterId,
        costCenterName: ccNameMap.get(line.costCenterId) ?? line.costCenter?.name ?? "不明",
        allocationRate: rate,
        allocatedAmount,
        allocatedTaxAmount,
        ownerCostCenterName: ownerCcName,
        isOwnerProject: ownerCcId !== null && targetCcIds.includes(ownerCcId),
        periodFrom: toLocalDateString(tx.periodFrom),
        periodTo: toLocalDateString(tx.periodTo),
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
  counterpartyId: number | string;
  operatingCompanyId: number;
  bankAccountId?: number | null;
  invoiceDate?: string | null;
  paymentDueDate: string; // 必須
  expectedPaymentDate: string; // 必須
  transactionIds: number[];
  projectId?: number;
}): Promise<{ id: number; invoiceNumber: string | null }> {
  const user = await requireEdit("stp");
  const stpProjectId = await requireStpProjectId();

  // 必須入力チェック
  if (!data.paymentDueDate) {
    throw new Error("入金期限は必須入力です");
  }
  if (!data.expectedPaymentDate) {
    throw new Error("入金予定日は必須入力です");
  }

  // new-XX 形式の場合は先に Counterparty を作成
  const resolvedCounterpartyId = await resolveCounterpartyId(data.counterpartyId, user.id);

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
    // 請求書の宛先は取引の取引先と異なってもOK（グループ会社への請求先変更等）

    // 金額計算（取引の税額を単純合計）
    const { subtotal, taxAmount, totalAmount } = calcGroupTotals(transactions);

    // 請求日（未指定なら今日）
    const autoInvoiceDate = data.invoiceDate ? new Date(data.invoiceDate) : new Date();

    // InvoiceGroup作成（サーバー側で取得したprojectIdを使用）
    // paymentDueDate / expectedPaymentDate は上部で必須チェック済み
    const group = await tx.invoiceGroup.create({
      data: {
        counterpartyId: resolvedCounterpartyId,
        operatingCompanyId: data.operatingCompanyId,
        bankAccountId: data.bankAccountId ?? null,
        invoiceDate: autoInvoiceDate,
        paymentDueDate: new Date(data.paymentDueDate),
        expectedPaymentDate: new Date(data.expectedPaymentDate),
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

    await recordChangeLog(
      {
        tableName: "InvoiceGroup",
        recordId: group.id,
        changeType: "create",
        newData: { status: "draft", counterpartyId: resolvedCounterpartyId, operatingCompanyId: data.operatingCompanyId },
      },
      user.id,
      tx
    );

    return { id: group.id, invoiceNumber: null };
  });

  revalidatePath("/stp/finance/invoices");
  revalidatePath("/stp/finance/transactions");
  return result;
}

// ============================================
// 更新
// ============================================

/**
 * counterpartyIdが "new-{companyId}" 形式の場合、Counterpartyを自動作成して実IDを返す。
 * 既に数値の場合はそのまま返す。
 */
async function resolveCounterpartyId(
  counterpartyIdOrNew: number | string,
  staffId: number
): Promise<number> {
  const str = String(counterpartyIdOrNew);
  if (str.startsWith("new-")) {
    const companyId = Number(str.replace("new-", ""));
    if (!Number.isInteger(companyId) || companyId <= 0) {
      throw new Error("無効な企業IDです");
    }
    const cpId = await ensureCounterpartyForCompany(companyId, staffId);
    return cpId;
  }
  const id = Number(counterpartyIdOrNew);
  if (!Number.isInteger(id) || id <= 0) {
    throw new Error("無効な取引先IDです");
  }
  return id;
}

/**
 * MasterStellaCompanyに対応するCounterpartyを確保して返す。
 * 既存があればそのID、なければ作成してIDを返す。
 */
async function ensureCounterpartyForCompany(
  companyId: number,
  staffId: number
): Promise<number> {
  // 既存チェック
  const existing = await prisma.counterparty.findFirst({
    where: { companyId, deletedAt: null, mergedIntoId: null },
    select: { id: true },
  });
  if (existing) return existing.id;

  // 作成（displayId重複時のリトライはcreateCounterpartyForCompany内で処理）
  const company = await prisma.masterStellaCompany.findUnique({
    where: { id: companyId },
    select: { id: true, name: true },
  });
  if (!company) throw new Error("企業が見つかりません");

  await createCounterpartyForCompany(company.id, company.name, staffId);

  const cp = await prisma.counterparty.findFirst({
    where: { companyId: company.id, deletedAt: null, mergedIntoId: null },
    select: { id: true },
  });
  if (!cp) throw new Error("取引先の作成に失敗しました");
  return cp.id;
}

export async function updateInvoiceGroup(
  id: number,
  data: {
    counterpartyId?: number | string;
    bankAccountId?: number | null;
    invoiceDate?: string | null;
    paymentDueDate?: string | null;
    expectedPaymentDate?: string | null;
    actualPaymentDate?: string | null;
    subtotal?: number | null;
    taxAmount?: number | null;
    totalAmount?: number | null;
    honorific?: string;
    remarks?: string | null;
    lineDescriptions?: Record<string, string> | null;
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

  // 経理引き渡し後は actualPaymentDate の編集も不可
  if (
    onlyActualPaymentDate &&
    ["awaiting_accounting", "partially_paid", "paid"].includes(group.status)
  ) {
    throw new Error("経理引き渡し後は編集できません");
  }

  // 送付済み以降・返送は編集不可（actualPaymentDateのみは例外）
  if (
    !onlyActualPaymentDate &&
    ["sent", "awaiting_accounting", "partially_paid", "paid", "corrected", "returned"].includes(group.status)
  ) {
    throw new Error("このステータスでは編集できません");
  }

  const updateData: Record<string, unknown> = {
    updater: { connect: { id: user.id } },
  };

  if ("counterpartyId" in data && data.counterpartyId != null) {
    const cpId = await resolveCounterpartyId(data.counterpartyId, user.id);
    updateData.counterparty = { connect: { id: cpId } };
  }
  if ("bankAccountId" in data) {
    updateData.bankAccount = data.bankAccountId
      ? { connect: { id: data.bankAccountId } }
      : { disconnect: true };
  }
  if ("invoiceDate" in data)
    updateData.invoiceDate = data.invoiceDate
      ? new Date(data.invoiceDate)
      : null;
  if ("paymentDueDate" in data) {
    if (!data.paymentDueDate) {
      throw new Error("入金期限は必須入力です");
    }
    updateData.paymentDueDate = new Date(data.paymentDueDate);
  }
  if ("expectedPaymentDate" in data) {
    if (!data.expectedPaymentDate) {
      throw new Error("入金予定日は必須入力です");
    }
    updateData.expectedPaymentDate = new Date(data.expectedPaymentDate);
  }
  if ("actualPaymentDate" in data)
    updateData.actualPaymentDate = data.actualPaymentDate
      ? new Date(data.actualPaymentDate)
      : null;
  if ("subtotal" in data) updateData.subtotal = data.subtotal;
  if ("taxAmount" in data) updateData.taxAmount = data.taxAmount;
  if ("totalAmount" in data) updateData.totalAmount = data.totalAmount;
  if ("honorific" in data) updateData.honorific = data.honorific;
  if ("remarks" in data) updateData.remarks = data.remarks ?? null;
  if ("lineDescriptions" in data)
    updateData.lineDescriptions = data.lineDescriptions ?? null;

  // pdf_created状態で情報が変更された場合、ステータスをdraftに戻す
  if (group.status === "pdf_created") {
    updateData.pdfPath = null;
    updateData.pdfFileName = null;
    updateData.status = "draft";
  }

  // 変更前後データを記録
  const oldData: Record<string, unknown> = {};
  const newData: Record<string, unknown> = {};
  if ("bankAccountId" in data && data.bankAccountId !== (group.bankAccountId ?? null)) {
    oldData.bankAccountId = group.bankAccountId;
    newData.bankAccountId = data.bankAccountId ?? null;
  }
  if ("invoiceDate" in data) {
    oldData.invoiceDate = group.invoiceDate ? toLocalDateString(group.invoiceDate) : null;
    newData.invoiceDate = data.invoiceDate ?? null;
  }
  if ("paymentDueDate" in data) {
    oldData.paymentDueDate = group.paymentDueDate ? toLocalDateString(group.paymentDueDate) : null;
    newData.paymentDueDate = data.paymentDueDate ?? null;
  }
  if ("expectedPaymentDate" in data) {
    oldData.expectedPaymentDate = group.expectedPaymentDate ? toLocalDateString(group.expectedPaymentDate) : null;
    newData.expectedPaymentDate = data.expectedPaymentDate ?? null;
  }
  if ("actualPaymentDate" in data) {
    oldData.actualPaymentDate = group.actualPaymentDate ? toLocalDateString(group.actualPaymentDate) : null;
    newData.actualPaymentDate = data.actualPaymentDate ?? null;
  }

  await prisma.$transaction(async (tx) => {
    await tx.invoiceGroup.update({
      where: { id },
      data: updateData,
    });

    if (Object.keys(newData).length > 0) {
      await recordChangeLog(
        {
          tableName: "InvoiceGroup",
          recordId: id,
          changeType: "update",
          oldData,
          newData,
        },
        user.id,
        tx
      );
    }

    // 経理→STP入金日連携: actualPaymentDate変更時にStpRevenueRecordのpaidDateも更新
    if ("actualPaymentDate" in data) {
      await syncPaymentDateToRevenueRecords(tx, id, data.actualPaymentDate ? new Date(data.actualPaymentDate) : null);
    }
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

  // 既存取引の取引先を取得（請求書の宛先と異なる場合があるため、取引ベースでチェック）
  const existingCounterpartyIds = new Set(
    group.transactions.map((t) => t.counterpartyId)
  );

  // 追加する取引を検証（projectIdでスコープ）
  const txWhere: Record<string, unknown> = {
    id: { in: transactionIds },
    deletedAt: null,
    status: "confirmed",
    invoiceGroupId: null,
    type: "revenue",
    projectId: stpProjectId,
  };
  // 既存取引がある場合は同一取引先のみ追加可能
  if (existingCounterpartyIds.size === 1) {
    txWhere.counterpartyId = [...existingCounterpartyIds][0];
  }
  const transactions = await prisma.transaction.findMany({
    where: txWhere,
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

    await recordChangeLog(
      {
        tableName: "InvoiceGroup",
        recordId: groupId,
        changeType: "update",
        newData: { addedTransactionIds: transactions.map((t) => t.id) },
      },
      user.id,
      tx
    );
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

    await recordChangeLog(
      {
        tableName: "InvoiceGroup",
        recordId: groupId,
        changeType: "update",
        newData: { removedTransactionIds: [transactionId] },
      },
      user.id,
      tx
    );
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

    await recordChangeLog(
      {
        tableName: "InvoiceGroup",
        recordId: id,
        changeType: "delete",
        oldData: { status: group.status },
      },
      user.id,
      tx
    );
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

  // paid への遷移時に actualPaymentDate を自動設定
  const additionalData: Record<string, unknown> = {};
  if (newStatus === "paid" && !group.actualPaymentDate) {
    additionalData.actualPaymentDate = new Date(toLocalDateString(new Date()));
  }

  const oldStatus = group.status;
  await prisma.$transaction(async (tx) => {
    await tx.invoiceGroup.update({
      where: { id },
      data: { status: newStatus, updatedBy: user.id, ...additionalData },
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

    // 経理→STP入金日連携: paid遷移時にStpRevenueRecordのpaidDateも更新
    if (newStatus === "paid") {
      const paymentDate = additionalData.actualPaymentDate
        ? (additionalData.actualPaymentDate as Date)
        : group.actualPaymentDate;
      if (paymentDate) {
        await syncPaymentDateToRevenueRecords(tx, id, paymentDate);
      }
    }
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

    if (!group.bankAccountId) {
      throw new Error("振込先口座が未設定です。基本情報タブで口座を設定してからPDFを作成してください。");
    }

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

  // DB更新: pdfPath, pdfFileName, status + 証憑（Attachment）に保存
  // ファイル名: 請求書_{取引先名}{御中/様}_{YYYYMMDD_HHmmss}.pdf
  const counterpartyName = data.counterpartyName ?? "";
  const honorific = data.honorific ?? "御中";
  const pdfDisplayName = `${counterpartyName}${honorific}`;
  const timestamp = formatTimestamp(now);
  const displayFileName = `請求書_${pdfDisplayName}_${timestamp}.pdf`;

  await prisma.$transaction(async (tx) => {
    await tx.invoiceGroup.update({
      where: { id: groupId },
      data: {
        pdfPath: publicPath,
        pdfFileName: displayFileName,
        status: "pdf_created",
        updatedBy: user.id,
      },
    });

    // 証憑タブに表示されるよう Attachment レコードを作成
    // 既存のPDF証憑を「旧」にリネームして保持（論理削除ではなくattachmentType変更）
    const existingInvoiceAttachments = await tx.attachment.findMany({
      where: {
        invoiceGroupId: groupId,
        attachmentType: "invoice",
        deletedAt: null,
      },
    });
    for (const att of existingInvoiceAttachments) {
      await tx.attachment.update({
        where: { id: att.id },
        data: {
          attachmentType: "invoice_old",
          generatedName: att.generatedName ? `[旧] ${att.generatedName}` : null,
        },
      });
    }

    await tx.attachment.create({
      data: {
        invoiceGroupId: groupId,
        fileName: displayFileName,
        filePath: publicPath,
        fileSize: buffer.length,
        mimeType: "application/pdf",
        attachmentType: "invoice",
        displayName: pdfDisplayName,
        generatedName: displayFileName,
        uploadedBy: user.id,
      },
    });
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

  // 入金期限・入金予定日の必須チェック (経理引渡し時)
  if (!group.paymentDueDate) {
    throw new Error("入金期限が未設定です。詳細画面で設定してから引き渡してください");
  }
  if (!group.expectedPaymentDate) {
    throw new Error("入金予定日が未設定です。詳細画面で設定してから引き渡してください");
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
    attachmentType: a.attachmentType,
    displayName: a.displayName,
    generatedName: a.generatedName,
    createdAt: a.createdAt.toISOString(),
  }));
}

export async function addInvoiceGroupAttachments(
  groupId: number,
  files: {
    filePath: string;
    fileName: string;
    fileSize: number;
    mimeType: string;
    attachmentType?: string;
    displayName?: string;
    generatedName?: string;
  }[]
) {
  const session = await requireEdit("stp");
  await prisma.attachment.createMany({
    data: files.map((f) => ({
      invoiceGroupId: groupId,
      filePath: f.filePath,
      fileName: f.generatedName ?? f.fileName,
      fileSize: f.fileSize,
      mimeType: f.mimeType,
      attachmentType: f.attachmentType ?? "voucher",
      displayName: f.displayName ?? null,
      generatedName: f.generatedName ?? null,
      uploadedBy: session.id,
    })),
  });

  await recordChangeLog(
    {
      tableName: "InvoiceGroup",
      recordId: groupId,
      changeType: "update",
      newData: { addedAttachments: files.map((f) => f.generatedName ?? f.fileName) },
    },
    session.id
  );

  revalidatePath("/stp/finance/invoices");
}

export async function deleteInvoiceGroupAttachment(attachmentId: number) {
  const session = await requireEdit("stp");
  const attachment = await prisma.attachment.findUnique({
    where: { id: attachmentId },
    select: { fileName: true, invoiceGroupId: true },
  });
  await prisma.attachment.update({
    where: { id: attachmentId },
    data: { deletedAt: new Date() },
  });

  if (attachment?.invoiceGroupId) {
    await recordChangeLog(
      {
        tableName: "InvoiceGroup",
        recordId: attachment.invoiceGroupId,
        changeType: "update",
        newData: { deletedAttachment: attachment.fileName },
      },
      session.id
    );
  }

  revalidatePath("/stp/finance/invoices");
}

// ============================================
// 請求書ビルダー: 詳細データ取得
// ============================================

export async function getInvoiceGroupDetail(groupId: number) {
  const stpProjectId = await requireStpProjectId();

  const group = await prisma.invoiceGroup.findUnique({
    where: { id: groupId, deletedAt: null, projectId: stpProjectId },
    include: {
      counterparty: true,
      operatingCompany: true,
      bankAccount: true,
      transactions: {
        where: { deletedAt: null },
        include: { expenseCategory: true },
        orderBy: [{ periodFrom: "asc" }, { id: "asc" }],
      },
      memoLines: {
        orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
      },
    },
  });
  if (!group) throw new Error("請求が見つかりません");

  // デフォルト送信元メールアドレスを取得
  let senderEmail: string | null = null;
  if (group.projectId) {
    const projectEmail = await prisma.projectEmail.findFirst({
      where: { projectId: group.projectId, isDefault: true },
      include: { email: true },
    });
    if (projectEmail) {
      senderEmail = projectEmail.email.email;
    }
  }
  if (!senderEmail && group.operatingCompanyId) {
    const defaultEmail = await prisma.operatingCompanyEmail.findFirst({
      where: { operatingCompanyId: group.operatingCompanyId, isDefault: true, deletedAt: null },
    });
    if (defaultEmail) {
      senderEmail = defaultEmail.email;
    }
  }

  // 税額サマリー計算（プレビュー用）
  const lineItemsForTax = group.transactions.map((t) => ({
    amount: t.taxType === "tax_excluded" ? t.amount : t.amount - t.taxAmount,
    taxRate: t.taxRate,
  }));
  const taxSummary = calcInvoiceTaxSummary(lineItemsForTax);

  // 取引元の取引先を取得（宛先変更の判別用）
  const transactionCounterpartyIds = new Set(
    group.transactions.map((t) => t.counterpartyId)
  );
  const originalCounterpartyId = transactionCounterpartyIds.size === 1
    ? [...transactionCounterpartyIds][0]
    : null;
  let originalCounterpartyName: string | null = null;
  if (originalCounterpartyId && originalCounterpartyId !== group.counterpartyId) {
    const originalCp = await prisma.counterparty.findUnique({
      where: { id: originalCounterpartyId },
      select: { name: true },
    });
    originalCounterpartyName = originalCp?.name ?? null;
  }

  return {
    id: group.id,
    counterpartyId: group.counterpartyId,
    counterpartyName: group.counterparty.name,
    originalCounterpartyId,
    originalCounterpartyName,
    operatingCompanyId: group.operatingCompanyId,
    operatingCompanyName: group.operatingCompany.companyName,
    operatingCompany: {
      companyName: group.operatingCompany.companyName,
      registrationNumber: group.operatingCompany.registrationNumber,
      postalCode: group.operatingCompany.postalCode,
      address: group.operatingCompany.address,
      address2: group.operatingCompany.address2,
      representativeName: group.operatingCompany.representativeName,
      phone: group.operatingCompany.phone,
      logoPath: group.operatingCompany.logoPath,
      email: senderEmail,
    },
    bankAccountId: group.bankAccountId,
    bankAccountLabel: group.bankAccount
      ? `${group.bankAccount.bankName} ${group.bankAccount.branchName} ${group.bankAccount.accountNumber}`
      : null,
    bankAccount: group.bankAccount
      ? {
          bankName: group.bankAccount.bankName,
          branchName: group.bankAccount.branchName,
          branchCode: group.bankAccount.branchCode,
          accountNumber: group.bankAccount.accountNumber,
          accountHolderName: group.bankAccount.accountHolderName,
        }
      : null,
    invoiceNumber: group.invoiceNumber,
    invoiceDate: group.invoiceDate ? toLocalDateString(group.invoiceDate) : null,
    paymentDueDate: group.paymentDueDate ? toLocalDateString(group.paymentDueDate) : null,
    honorific: group.honorific,
    remarks: group.remarks,
    lineOrder: group.lineOrder as string[] | null,
    lineDescriptions: (group.lineDescriptions as Record<string, string> | null) ?? null,
    status: group.status,
    subtotal: group.subtotal,
    taxAmount: group.taxAmount,
    totalAmount: group.totalAmount,
    pdfPath: group.pdfPath,
    taxSummary,
    transactions: group.transactions.map((t) => ({
      id: t.id,
      expenseCategoryName: t.expenseCategory?.name ?? "（未設定）",
      amount: t.amount,
      taxAmount: t.taxAmount,
      taxRate: t.taxRate,
      taxType: t.taxType,
      periodFrom: toLocalDateString(t.periodFrom),
      periodTo: toLocalDateString(t.periodTo),
      note: t.note,
    })),
    memoLines: group.memoLines.map((m) => ({
      id: m.id,
      description: m.description,
      sortOrder: m.sortOrder,
    })),
  };
}

// ============================================
// 請求書ビルダー: メモ行 CRUD
// ============================================

export async function addMemoLine(
  groupId: number,
  description: string,
  sortOrder?: number
): Promise<{ id: number }> {
  await requireEdit("stp");
  const stpProjectId = await requireStpProjectId();

  const group = await prisma.invoiceGroup.findUnique({
    where: { id: groupId, deletedAt: null, projectId: stpProjectId },
  });
  if (!group) throw new Error("請求が見つかりません");
  if (!["draft", "pdf_created"].includes(group.status)) {
    throw new Error("このステータスではメモ行を追加できません");
  }

  const maxOrder = sortOrder ?? (
    await prisma.invoiceGroupMemoLine.aggregate({
      where: { invoiceGroupId: groupId },
      _max: { sortOrder: true },
    })
  )._max?.sortOrder ?? 0;

  const line = await prisma.invoiceGroupMemoLine.create({
    data: {
      invoiceGroupId: groupId,
      description,
      sortOrder: sortOrder ?? maxOrder + 1,
    },
  });

  revalidatePath("/stp/finance/invoices");
  return { id: line.id };
}

export async function updateMemoLine(
  memoLineId: number,
  description: string
): Promise<void> {
  await requireEdit("stp");

  const line = await prisma.invoiceGroupMemoLine.findUnique({
    where: { id: memoLineId },
    include: { invoiceGroup: true },
  });
  if (!line) throw new Error("メモ行が見つかりません");
  if (!["draft", "pdf_created"].includes(line.invoiceGroup.status)) {
    throw new Error("このステータスではメモ行を編集できません");
  }

  await prisma.invoiceGroupMemoLine.update({
    where: { id: memoLineId },
    data: { description },
  });

  revalidatePath("/stp/finance/invoices");
}

export async function deleteMemoLine(memoLineId: number): Promise<void> {
  await requireEdit("stp");

  const line = await prisma.invoiceGroupMemoLine.findUnique({
    where: { id: memoLineId },
    include: { invoiceGroup: true },
  });
  if (!line) throw new Error("メモ行が見つかりません");
  if (!["draft", "pdf_created"].includes(line.invoiceGroup.status)) {
    throw new Error("このステータスではメモ行を削除できません");
  }

  await prisma.invoiceGroupMemoLine.delete({
    where: { id: memoLineId },
  });

  revalidatePath("/stp/finance/invoices");
}

// ============================================
// 請求書ビルダー: 明細表示順の保存
// ============================================

export async function updateLineOrder(
  groupId: number,
  lineOrder: string[]
): Promise<void> {
  const user = await requireEdit("stp");
  const stpProjectId = await requireStpProjectId();

  const group = await prisma.invoiceGroup.findUnique({
    where: { id: groupId, deletedAt: null, projectId: stpProjectId },
  });
  if (!group) throw new Error("請求が見つかりません");
  if (!["draft", "pdf_created"].includes(group.status)) {
    throw new Error("このステータスでは並び順を変更できません");
  }

  await prisma.invoiceGroup.update({
    where: { id: groupId },
    data: { lineOrder, updatedBy: user.id },
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
    expenseCategoryName: r.expenseCategory?.name ?? "（未設定）",
    amount: r.amount,
    taxAmount: r.taxAmount,
    taxRate: r.taxRate,
    taxType: r.taxType,
    periodFrom: toLocalDateString(r.periodFrom),
    periodTo: toLocalDateString(r.periodTo),
    note: r.note,
  }));
}

// ============================================
// 入金期限自動計算（取引先 → 運営法人フォールバック）
// ============================================

export async function calculatePaymentDueDate(
  counterpartyId: number,
  operatingCompanyId: number,
  invoiceDate?: string
): Promise<string | null> {
  const baseDate = invoiceDate ? new Date(invoiceDate) : new Date();

  // 1. 取引先の支払条件
  const counterparty = await prisma.counterparty.findUnique({
    where: { id: counterpartyId },
    include: { company: true },
  });
  if (counterparty?.company) {
    const { closingDay, paymentMonthOffset, paymentDay } = counterparty.company;
    const due = calcDueDate({ invoiceDate: baseDate, closingDay, paymentMonthOffset, paymentDay });
    if (due) return toLocalDateString(due);
  }

  // 2. 運営法人の支払条件（フォールバック）
  const opCo = await prisma.operatingCompany.findUnique({
    where: { id: operatingCompanyId },
    select: { paymentMonthOffset: true, paymentDay: true },
  });
  if (opCo) {
    const due = calcDueDate({
      invoiceDate: baseDate,
      closingDay: null,
      paymentMonthOffset: opCo.paymentMonthOffset,
      paymentDay: opCo.paymentDay,
    });
    if (due) return toLocalDateString(due);
  }

  return null;
}

// ============================================
// 差し戻し依頼
// ============================================

export async function requestReturnInvoiceGroup(
  id: number,
  data: { body: string }
): Promise<void> {
  const user = await requireEdit("stp");
  const stpProjectId = await requireStpProjectId();

  const group = await prisma.invoiceGroup.findUnique({
    where: { id, deletedAt: null, projectId: stpProjectId },
  });
  if (!group) throw new Error("請求グループが見つかりません");

  if (!["awaiting_accounting", "partially_paid", "paid"].includes(group.status)) {
    throw new Error("このステータスでは差し戻し依頼できません");
  }

  if (!data.body.trim()) {
    throw new Error("差し戻し理由を入力してください");
  }

  // コメントを作成
  await prisma.transactionComment.create({
    data: {
      invoiceGroupId: id,
      body: data.body.trim(),
      commentType: "return",
      returnReasonType: "correction_request",
      createdBy: user.id,
    },
  });

  // 経理権限を持つスタッフを取得して通知
  const accountingProject = await prisma.masterProject.findFirst({
    where: { code: "accounting" },
    select: { id: true },
  });

  if (accountingProject) {
    const permissions = await prisma.staffPermission.findMany({
      where: {
        projectId: accountingProject.id,
        permissionLevel: { in: ["edit", "manager"] },
      },
      select: { staffId: true },
    });

    const recipientIds = permissions.map((p) => p.staffId);

    if (recipientIds.length > 0) {
      await createNotificationBulk(recipientIds, {
        senderType: "staff",
        senderId: user.id,
        category: "accounting",
        title: `差し戻し依頼: 請求グループ #${id}`,
        message: data.body.trim(),
        linkUrl: "/accounting/batch-complete",
      });
    }
  }

  revalidatePath("/stp/finance/invoices");
}

// ============================================
// 経理引渡の取消（経理側で仕訳未処理の場合のみ）
// ============================================

export async function cancelInvoiceGroupHandover(
  id: number
): Promise<void> {
  const user = await requireEdit("stp");
  const stpProjectId = await requireStpProjectId();

  const group = await prisma.invoiceGroup.findUnique({
    where: { id, deletedAt: null, projectId: stpProjectId },
    include: {
      transactions: {
        where: { deletedAt: null },
        select: { id: true, journalCompleted: true },
      },
    },
  });
  if (!group) throw new Error("請求グループが見つかりません");

  if (group.status !== "awaiting_accounting") {
    throw new Error("「経理処理待ち」ステータスの請求のみ引渡を取り消せます");
  }

  // 仕訳処理が開始されていないかチェック
  const txIds = group.transactions.map((t) => t.id);

  if (group.transactions.some((t) => t.journalCompleted)) {
    throw new Error("経理側で仕訳処理が開始されているため、引渡を取り消せません");
  }

  if (txIds.length > 0) {
    const journalCount = await prisma.journalEntry.count({
      where: {
        deletedAt: null,
        OR: [
          { invoiceGroupId: id },
          { transactionId: { in: txIds } },
        ],
      },
    });
    if (journalCount > 0) {
      throw new Error("経理側で仕訳処理が開始されているため、引渡を取り消せません");
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.invoiceGroup.update({
      where: { id },
      data: { status: "sent", updatedBy: user.id },
    });

    await recordChangeLog(
      {
        tableName: "InvoiceGroup",
        recordId: id,
        changeType: "update",
        oldData: { status: "awaiting_accounting" },
        newData: { status: "sent" },
      },
      user.id,
      tx
    );
  });

  revalidatePath("/stp/finance/invoices");
}

// 経理→STP入金日連携ヘルパー (syncPaymentDateToRevenueRecords) は
// src/lib/accounting/sync-payment-date.ts に共通ロジックとして切り出し済み
// → 経理側 (workflow/actions.ts) と本ファイルの両方から利用
