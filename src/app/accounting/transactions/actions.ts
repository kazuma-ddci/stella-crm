"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { autoConfirmCreatorAllocations, checkAndTransitionToAwaitingAccounting, sendAllocationNotifications } from "./allocation-actions";
import type { AllocationNotificationInfo } from "./allocation-actions";
import { createNotification } from "@/lib/notifications/create-notification";
import { recordChangeLog, extractChanges, pickRecordData } from "@/app/accounting/changelog/actions";
import { TRANSACTION_LOG_FIELDS } from "@/app/accounting/changelog/log-fields";
import { ensureMonthNotClosed } from "@/lib/finance/monthly-close";

// ============================================
// 型定義
// ============================================

export type TransactionFormData = {
  counterparties: {
    id: number;
    name: string;
    counterpartyType: string;
  }[];
  expenseCategories: {
    id: number;
    name: string;
    type: string;
  }[];
  costCenters: {
    id: number;
    name: string;
    projectId: number | null;
  }[];
  allocationTemplates: {
    id: number;
    name: string;
    lines: {
      id: number;
      costCenterId: number | null;
      allocationRate: unknown; // Decimal
      label: string | null;
      costCenter: { id: number; name: string } | null;
    }[];
  }[];
  paymentMethods: {
    id: number;
    name: string;
    methodType: string;
  }[];
  contracts: {
    id: number;
    title: string;
    companyId: number;
    company: { id: number; name: string };
    endDate: Date | null;
  }[];
};

// ============================================
// バリデーション
// ============================================

const VALID_TYPES = ["revenue", "expense"] as const;
const VALID_TAX_TYPES = ["tax_included", "tax_excluded"] as const;

function validateTransactionData(data: Record<string, unknown>) {
  // type
  const type = data.type as string;
  if (!type || !(VALID_TYPES as readonly string[]).includes(type)) {
    throw new Error("種別（revenue/expense）は必須です");
  }

  // taxType
  const taxType = (data.taxType as string) || "tax_excluded";
  if (!(VALID_TAX_TYPES as readonly string[]).includes(taxType)) {
    throw new Error("税区分（tax_included/tax_excluded）が不正です");
  }

  // counterpartyId
  const counterpartyId = Number(data.counterpartyId);
  if (!data.counterpartyId || isNaN(counterpartyId)) {
    throw new Error("取引先は必須です");
  }

  // expenseCategoryId
  const expenseCategoryId = Number(data.expenseCategoryId);
  if (!data.expenseCategoryId || isNaN(expenseCategoryId)) {
    throw new Error("費目は必須です");
  }

  // amount
  const amount = Number(data.amount);
  if (data.amount === undefined || data.amount === null || isNaN(amount) || amount < 0 || !Number.isInteger(amount)) {
    throw new Error("金額は0以上の整数で入力してください");
  }

  // taxRate
  const taxRate = Number(data.taxRate);
  if (data.taxRate === undefined || data.taxRate === null || isNaN(taxRate) || !Number.isInteger(taxRate)) {
    throw new Error("税率は整数で入力してください");
  }

  // taxAmount
  const taxAmount = Number(data.taxAmount);
  if (data.taxAmount === undefined || data.taxAmount === null || isNaN(taxAmount) || !Number.isInteger(taxAmount)) {
    throw new Error("消費税額は整数で入力してください");
  }

  // 消費税額の妥当性チェック（手動修正を許容しつつ、大幅な乖離を防ぐ）
  if (amount > 0 && taxRate > 0) {
    let expectedTax: number;
    if (taxType === "tax_included") {
      expectedTax = Math.floor(amount - amount / (1 + taxRate / 100));
    } else {
      expectedTax = Math.floor(amount * taxRate / 100);
    }
    // 手動修正を許容: 自動計算値との差が20%以上ある場合は警告
    if (expectedTax > 0 && Math.abs(taxAmount - expectedTax) / expectedTax > 0.2) {
      // 手動修正は許容するためエラーにはしない（ログ出力で追跡可能）
      console.warn(
        `消費税額が自動計算値と乖離しています: 入力=${taxAmount}, 期待=${expectedTax}, taxType=${taxType}`
      );
    }
  }

  // periodFrom, periodTo
  if (!data.periodFrom) {
    throw new Error("発生期間（開始）は必須です");
  }
  if (!data.periodTo) {
    throw new Error("発生期間（終了）は必須です");
  }
  const periodFrom = new Date(data.periodFrom as string);
  const periodTo = new Date(data.periodTo as string);
  if (isNaN(periodFrom.getTime())) {
    throw new Error("発生期間（開始）が無効な日付です");
  }
  if (isNaN(periodTo.getTime())) {
    throw new Error("発生期間（終了）が無効な日付です");
  }
  if (periodFrom > periodTo) {
    throw new Error("発生期間の開始日は終了日以前にしてください");
  }

  // allocationTemplateId と costCenterId の排他チェック
  const allocationTemplateId = data.allocationTemplateId
    ? Number(data.allocationTemplateId)
    : null;
  const costCenterId = data.costCenterId
    ? Number(data.costCenterId)
    : null;

  if (allocationTemplateId && costCenterId) {
    throw new Error(
      "按分テンプレートと按分先は同時に指定できません"
    );
  }
  if (!allocationTemplateId && !costCenterId) {
    throw new Error(
      "按分テンプレートまたは按分先のいずれかを指定してください"
    );
  }

  return {
    type,
    taxType,
    counterpartyId,
    expenseCategoryId,
    amount,
    taxAmount,
    taxRate,
    periodFrom,
    periodTo,
    allocationTemplateId,
    costCenterId,
  };
}

// ============================================
// 1. createTransaction
// ============================================

export async function createTransaction(data: Record<string, unknown>) {
  const session = await getSession();
  const staffId = session.id;

  const validated = validateTransactionData(data);

  // 月次クローズチェック
  await checkMonthlyClose(validated.periodFrom, validated.periodTo);

  const contractId = data.contractId ? Number(data.contractId) : null;
  const projectId = data.projectId ? Number(data.projectId) : null;
  const paymentMethodId = data.paymentMethodId
    ? Number(data.paymentMethodId)
    : null;
  const paymentDueDate = data.paymentDueDate
    ? new Date(data.paymentDueDate as string)
    : null;
  const note = data.note ? (data.note as string).trim() || null : null;

  // 源泉徴収
  const isWithholdingTarget =
    data.isWithholdingTarget === true || data.isWithholdingTarget === "true";
  const withholdingTaxRate = data.withholdingTaxRate
    ? Number(data.withholdingTaxRate)
    : null;
  const withholdingTaxAmount = data.withholdingTaxAmount
    ? Number(data.withholdingTaxAmount)
    : null;
  const netPaymentAmount = data.netPaymentAmount
    ? Number(data.netPaymentAmount)
    : null;

  // 証憑
  const attachments = (data.attachments as Array<{
    filePath: string;
    fileName: string;
    fileSize?: number;
    mimeType?: string;
    attachmentType?: string;
  }>) || [];

  const result = await prisma.$transaction(async (tx) => {
    const transaction = await tx.transaction.create({
      data: {
        type: validated.type,
        counterpartyId: validated.counterpartyId,
        expenseCategoryId: validated.expenseCategoryId,
        amount: validated.amount,
        taxAmount: validated.taxAmount,
        taxRate: validated.taxRate,
        taxType: validated.taxType,
        periodFrom: validated.periodFrom,
        periodTo: validated.periodTo,
        allocationTemplateId: validated.allocationTemplateId,
        costCenterId: validated.costCenterId,
        contractId,
        projectId,
        paymentMethodId,
        paymentDueDate,
        note,
        sourceType: "manual",
        isWithholdingTarget,
        withholdingTaxRate,
        withholdingTaxAmount,
        netPaymentAmount,
        createdBy: staffId,
      },
    });

    // 証憑作成
    if (attachments.length > 0) {
      await tx.attachment.createMany({
        data: attachments.map((att) => ({
          transactionId: transaction.id,
          filePath: att.filePath,
          fileName: att.fileName,
          fileSize: att.fileSize ?? null,
          mimeType: att.mimeType ?? null,
          attachmentType: att.attachmentType ?? "other",
          uploadedBy: staffId,
        })),
      });
    }

    // 按分テンプレート使用時: 作成者プロジェクトのコストセンターを自動確定
    let notificationInfo: AllocationNotificationInfo | null = null;
    if (transaction.allocationTemplateId) {
      notificationInfo = await autoConfirmCreatorAllocations(
        transaction.id,
        projectId,
        staffId,
        tx
      );
    }

    // 変更履歴を記録
    await recordChangeLog(
      {
        tableName: "Transaction",
        recordId: transaction.id,
        changeType: "create",
        newData: await pickRecordData(
          transaction as unknown as Record<string, unknown>,
          [...TRANSACTION_LOG_FIELDS]
        ),
      },
      staffId,
      tx
    );

    return { transaction, notificationInfo };
  });

  // トランザクション完了後に按分確定依頼の通知を送信
  if (result.notificationInfo) {
    await sendAllocationNotifications(result.notificationInfo);
  }

  revalidatePath("/accounting/transactions");
  revalidatePath("/accounting/dashboard");

  return { id: result.transaction.id };
}

// ============================================
// 2. updateTransaction
// ============================================

export async function updateTransaction(
  id: number,
  data: Record<string, unknown>
) {
  const session = await getSession();
  const staffId = session.id;

  // 既存レコード取得
  const existing = await prisma.transaction.findFirst({
    where: { id, deletedAt: null },
    include: {
      attachments: { where: { deletedAt: null } },
    },
  });
  if (!existing) {
    throw new Error("取引が見つかりません");
  }

  // 編集可能なステータスのみ許可
  const editableStatuses = ["unconfirmed", "returned"];
  if (!editableStatuses.includes(existing.status)) {
    throw new Error(
      `ステータス「${existing.status}」の取引は編集できません（未確認または差し戻し状態の取引のみ編集可能です）`
    );
  }

  // 月次クローズチェック（既存レコードの日付）
  await checkMonthlyClose(existing.periodFrom, existing.periodTo);

  const validated = validateTransactionData(data);

  // 月次クローズチェック（新しい日付）
  await checkMonthlyClose(validated.periodFrom, validated.periodTo);

  const contractId = data.contractId ? Number(data.contractId) : null;
  const projectId = data.projectId ? Number(data.projectId) : null;
  const paymentMethodId = data.paymentMethodId
    ? Number(data.paymentMethodId)
    : null;
  const paymentDueDate = data.paymentDueDate
    ? new Date(data.paymentDueDate as string)
    : null;
  const note = data.note ? (data.note as string).trim() || null : null;

  // 源泉徴収
  const isWithholdingTarget =
    data.isWithholdingTarget === true || data.isWithholdingTarget === "true";
  const withholdingTaxRate = data.withholdingTaxRate
    ? Number(data.withholdingTaxRate)
    : null;
  const withholdingTaxAmount = data.withholdingTaxAmount
    ? Number(data.withholdingTaxAmount)
    : null;
  const netPaymentAmount = data.netPaymentAmount
    ? Number(data.netPaymentAmount)
    : null;

  // 証憑
  const incomingAttachments = (data.attachments as Array<{
    id?: number;
    filePath: string;
    fileName: string;
    fileSize?: number;
    mimeType?: string;
    attachmentType?: string;
  }>) || [];

  await prisma.$transaction(async (tx) => {
    // 取引更新
    const updated = await tx.transaction.update({
      where: { id },
      data: {
        type: validated.type,
        counterpartyId: validated.counterpartyId,
        expenseCategoryId: validated.expenseCategoryId,
        amount: validated.amount,
        taxAmount: validated.taxAmount,
        taxRate: validated.taxRate,
        taxType: validated.taxType,
        periodFrom: validated.periodFrom,
        periodTo: validated.periodTo,
        allocationTemplateId: validated.allocationTemplateId,
        costCenterId: validated.costCenterId,
        contractId,
        projectId,
        paymentMethodId,
        paymentDueDate,
        note,
        isWithholdingTarget,
        withholdingTaxRate,
        withholdingTaxAmount,
        netPaymentAmount,
        updatedBy: staffId,
      },
    });

    // 変更履歴を記録
    const oldData = await pickRecordData(
      existing as unknown as Record<string, unknown>,
      [...TRANSACTION_LOG_FIELDS]
    );
    const newData = await pickRecordData(
      updated as unknown as Record<string, unknown>,
      [...TRANSACTION_LOG_FIELDS]
    );
    const changes = await extractChanges(oldData, newData, [...TRANSACTION_LOG_FIELDS]);
    if (changes) {
      await recordChangeLog(
        {
          tableName: "Transaction",
          recordId: id,
          changeType: "update",
          oldData: changes.oldData,
          newData: changes.newData,
        },
        staffId,
        tx
      );
    }

    // 証憑の差分管理
    const incomingIds = new Set(
      incomingAttachments
        .filter((att) => att.id !== undefined)
        .map((att) => att.id as number)
    );

    // 既存で incoming に含まれないものを論理削除
    const toDelete = existing.attachments.filter(
      (att) => !incomingIds.has(att.id)
    );
    if (toDelete.length > 0) {
      await tx.attachment.updateMany({
        where: { id: { in: toDelete.map((att) => att.id) } },
        data: { deletedAt: new Date() },
      });
    }

    // 新規追加（idがないもの）
    const toCreate = incomingAttachments.filter(
      (att) => att.id === undefined
    );
    if (toCreate.length > 0) {
      await tx.attachment.createMany({
        data: toCreate.map((att) => ({
          transactionId: id,
          filePath: att.filePath,
          fileName: att.fileName,
          fileSize: att.fileSize ?? null,
          mimeType: att.mimeType ?? null,
          attachmentType: att.attachmentType ?? "other",
          uploadedBy: staffId,
        })),
      });
    }
  });

  revalidatePath("/accounting/transactions");
}

// ============================================
// 3. getTransactionById
// ============================================

export async function getTransactionById(id: number) {
  const transaction = await prisma.transaction.findFirst({
    where: { id, deletedAt: null },
    include: {
      counterparty: {
        select: { id: true, name: true, counterpartyType: true },
      },
      contract: {
        select: {
          id: true,
          title: true,
          company: { select: { id: true, name: true } },
        },
      },
      allocationTemplate: {
        include: {
          lines: {
            include: {
              costCenter: { select: { id: true, name: true } },
            },
          },
        },
      },
      costCenter: {
        select: { id: true, name: true, projectId: true },
      },
      expenseCategory: {
        select: { id: true, name: true, type: true },
      },
      project: {
        select: { id: true, name: true, code: true },
      },
      paymentMethod: {
        select: { id: true, name: true, methodType: true },
      },
      attachments: {
        where: { deletedAt: null },
      },
    },
  });

  return transaction ?? null;
}

// ============================================
// 4. getTransactionFormData
// ============================================

// ============================================
// ステータス遷移定義
// ============================================

const VALID_STATUS_TRANSITIONS: Record<string, string[]> = {
  unconfirmed: ["confirmed"],
  confirmed: ["awaiting_accounting", "returned"],
  awaiting_accounting: ["journalized", "returned"],
  returned: ["resubmitted"],
  resubmitted: ["awaiting_accounting"],
  journalized: ["partially_paid", "paid"],
  partially_paid: ["paid"],
  paid: ["hidden"],
};

// ============================================
// 月次クローズチェック
// ============================================

async function checkMonthlyClose(periodFrom: Date, periodTo: Date) {
  // periodFrom〜periodToに含まれる全ての月を対象にチェック
  const startMonth = new Date(periodFrom.getFullYear(), periodFrom.getMonth(), 1);
  const endMonth = new Date(periodTo.getFullYear(), periodTo.getMonth(), 1);

  const current = new Date(startMonth);
  while (current <= endMonth) {
    await ensureMonthNotClosed(current);
    current.setMonth(current.getMonth() + 1);
  }
}

// ============================================
// 5. confirmTransaction（未確認→確認済み）
// ============================================

export async function confirmTransaction(id: number) {
  const session = await getSession();
  const staffId = session.id;

  const transaction = await prisma.transaction.findFirst({
    where: { id, deletedAt: null },
    select: { id: true, status: true, periodFrom: true, periodTo: true, projectId: true },
  });
  if (!transaction) {
    throw new Error("取引が見つかりません");
  }

  if (transaction.status !== "unconfirmed") {
    throw new Error(
      `ステータス「${transaction.status}」の取引は確認できません（未確認の取引のみ確認可能です）`
    );
  }

  await checkMonthlyClose(transaction.periodFrom, transaction.periodTo);

  await prisma.$transaction(async (tx) => {
    await tx.transaction.update({
      where: { id },
      data: {
        status: "confirmed",
        confirmedBy: staffId,
        confirmedAt: new Date(),
        updatedBy: staffId,
      },
    });

    // 変更履歴を記録
    await recordChangeLog(
      {
        tableName: "Transaction",
        recordId: id,
        changeType: "update",
        oldData: { status: transaction.status },
        newData: { status: "confirmed" },
      },
      staffId,
      tx
    );
  });

  // 按分テンプレート使用時: 全プロジェクト確定済みなら自動的に「経理処理待ち」へ遷移
  await checkAndTransitionToAwaitingAccounting(id);

  revalidatePath("/accounting/transactions");
}

// ============================================
// 6. returnTransaction（確認済み/経理処理待ち→差し戻し）
// ============================================

export async function returnTransaction(
  id: number,
  data: { body: string; returnReasonType: string }
) {
  const session = await getSession();
  const staffId = session.id;

  const VALID_RETURN_REASONS = [
    "question",
    "correction_request",
    "approval_check",
    "other",
  ] as const;

  if (!data.body?.trim()) {
    throw new Error("差し戻しコメントは必須です");
  }
  if (
    !data.returnReasonType ||
    !(VALID_RETURN_REASONS as readonly string[]).includes(data.returnReasonType)
  ) {
    throw new Error("差し戻し理由の種別を選択してください");
  }

  const transaction = await prisma.transaction.findFirst({
    where: { id, deletedAt: null },
    select: { id: true, status: true, periodFrom: true, periodTo: true, projectId: true, createdBy: true },
  });
  if (!transaction) {
    throw new Error("取引が見つかりません");
  }

  const allowedFrom = VALID_STATUS_TRANSITIONS[transaction.status] ?? [];
  if (!allowedFrom.includes("returned")) {
    throw new Error(
      `ステータス「${transaction.status}」の取引は差し戻しできません`
    );
  }

  await checkMonthlyClose(transaction.periodFrom, transaction.periodTo);

  await prisma.$transaction(async (tx) => {
    await tx.transaction.update({
      where: { id },
      data: {
        status: "returned",
        updatedBy: staffId,
      },
    });

    await tx.transactionComment.create({
      data: {
        transactionId: id,
        body: data.body.trim(),
        commentType: "return",
        returnReasonType: data.returnReasonType,
        createdBy: staffId,
      },
    });

    // 変更履歴を記録
    await recordChangeLog(
      {
        tableName: "Transaction",
        recordId: id,
        changeType: "update",
        oldData: { status: transaction.status },
        newData: { status: "returned" },
      },
      staffId,
      tx
    );
  });

  // 差し戻し通知を作成者に送信
  if (transaction.createdBy && transaction.createdBy !== staffId) {
    await createNotification({
      recipientId: transaction.createdBy,
      senderType: "staff",
      senderId: staffId,
      category: "accounting",
      title: "取引が差し戻されました",
      message: data.body.trim(),
      linkUrl: `/accounting/transactions`,
    });
  }

  revalidatePath("/accounting/transactions");
}

// ============================================
// 7. resubmitTransaction（差し戻し→再提出）
// ============================================

export async function resubmitTransaction(id: number, body?: string) {
  const session = await getSession();
  const staffId = session.id;

  const transaction = await prisma.transaction.findFirst({
    where: { id, deletedAt: null },
    select: { id: true, status: true, periodFrom: true, periodTo: true, projectId: true },
  });
  if (!transaction) {
    throw new Error("取引が見つかりません");
  }

  if (transaction.status !== "returned") {
    throw new Error(
      `ステータス「${transaction.status}」の取引は再提出できません（差し戻し状態の取引のみ再提出可能です）`
    );
  }

  await checkMonthlyClose(transaction.periodFrom, transaction.periodTo);

  await prisma.$transaction(async (tx) => {
    await tx.transaction.update({
      where: { id },
      data: {
        status: "resubmitted",
        updatedBy: staffId,
      },
    });

    if (body?.trim()) {
      await tx.transactionComment.create({
        data: {
          transactionId: id,
          body: body.trim(),
          commentType: "normal",
          createdBy: staffId,
        },
      });
    }

    // 変更履歴を記録
    await recordChangeLog(
      {
        tableName: "Transaction",
        recordId: id,
        changeType: "update",
        oldData: { status: transaction.status },
        newData: { status: "resubmitted" },
      },
      staffId,
      tx
    );
  });

  revalidatePath("/accounting/transactions");
}

// ============================================
// 7b. submitToAccountingTransaction（確認済み/再提出→経理処理待ち）
// ============================================

export async function submitToAccountingTransaction(id: number) {
  const session = await getSession();
  const staffId = session.id;

  const transaction = await prisma.transaction.findFirst({
    where: { id, deletedAt: null },
    select: {
      id: true,
      status: true,
      periodFrom: true,
      periodTo: true,
      allocationTemplateId: true,
    },
  });
  if (!transaction) {
    throw new Error("取引が見つかりません");
  }

  // confirmed または resubmitted のみ許可
  if (transaction.status !== "confirmed" && transaction.status !== "resubmitted") {
    throw new Error(
      `ステータス「${transaction.status}」の取引は経理へ引き渡しできません（確認済みまたは再提出の取引のみ可能です）`
    );
  }

  await checkMonthlyClose(transaction.periodFrom, transaction.periodTo);

  // 按分テンプレート使用時: 全按分が確定済みかチェック
  if (transaction.allocationTemplateId) {
    const template = await prisma.allocationTemplate.findUnique({
      where: { id: transaction.allocationTemplateId },
      include: { lines: true },
    });
    if (template) {
      const requiredCostCenterIds = template.lines
        .filter((l) => l.costCenterId !== null)
        .map((l) => l.costCenterId!);

      if (requiredCostCenterIds.length > 0) {
        const confirmations = await prisma.allocationConfirmation.findMany({
          where: { transactionId: id },
          select: { costCenterId: true },
        });
        const confirmedIds = new Set(confirmations.map((c) => c.costCenterId));
        const allConfirmed = requiredCostCenterIds.every((cid) =>
          confirmedIds.has(cid)
        );
        if (!allConfirmed) {
          throw new Error(
            "全ての按分先が確定されていないため、経理へ引き渡しできません"
          );
        }
      }
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.transaction.update({
      where: { id },
      data: {
        status: "awaiting_accounting",
        updatedBy: staffId,
      },
    });

    await recordChangeLog(
      {
        tableName: "Transaction",
        recordId: id,
        changeType: "update",
        oldData: { status: transaction.status },
        newData: { status: "awaiting_accounting" },
      },
      staffId,
      tx
    );
  });

  revalidatePath("/accounting/transactions");
}

// ============================================
// 8. hideTransaction（非表示 / 論理削除）
// ============================================

export async function hideTransaction(id: number) {
  const session = await getSession();
  const staffId = session.id;

  const transaction = await prisma.transaction.findFirst({
    where: { id, deletedAt: null },
    select: { id: true, status: true, periodFrom: true, periodTo: true, projectId: true },
  });
  if (!transaction) {
    throw new Error("取引が見つかりません");
  }

  if (transaction.status !== "paid") {
    throw new Error(
      `ステータス「${transaction.status}」の取引は非表示にできません（入金完了/支払完了の取引のみ非表示可能です）`
    );
  }

  await checkMonthlyClose(transaction.periodFrom, transaction.periodTo);

  await prisma.$transaction(async (tx) => {
    await tx.transaction.update({
      where: { id },
      data: {
        status: "hidden",
        deletedAt: new Date(),
        updatedBy: staffId,
      },
    });

    // 変更履歴を記録
    await recordChangeLog(
      {
        tableName: "Transaction",
        recordId: id,
        changeType: "update",
        oldData: { status: transaction.status },
        newData: { status: "hidden" },
      },
      staffId,
      tx
    );
  });

  revalidatePath("/accounting/transactions");
}

// ============================================
// 9. getTransactions（一覧取得）
// ============================================

export async function getTransactions(filters?: {
  projectId?: number;
  type?: string;
  status?: string;
  counterpartyId?: number;
}) {
  const where: Record<string, unknown> = {
    deletedAt: null,
    status: { not: "hidden" },
  };

  if (filters?.projectId) {
    where.projectId = filters.projectId;
  }
  if (filters?.type) {
    where.type = filters.type;
  }
  if (filters?.status) {
    where.status = filters.status;
  }
  if (filters?.counterpartyId) {
    where.counterpartyId = filters.counterpartyId;
  }

  return prisma.transaction.findMany({
    where,
    include: {
      counterparty: { select: { id: true, name: true } },
      expenseCategory: { select: { id: true, name: true } },
      costCenter: { select: { id: true, name: true } },
      project: { select: { id: true, name: true, code: true } },
      confirmer: { select: { id: true, name: true } },
      allocationTemplate: { select: { id: true, name: true } },
    },
    orderBy: [{ periodFrom: "desc" }, { id: "desc" }],
  });
}

// ============================================
// 10. isMonthClosed（月次クローズ状態チェック）
// ============================================

export async function isMonthClosed(
  targetMonth: Date,
  projectId: number
): Promise<boolean> {
  const monthStart = new Date(
    targetMonth.getFullYear(),
    targetMonth.getMonth(),
    1
  );

  const record = await prisma.accountingMonthlyClose.findFirst({
    where: {
      projectId,
      targetMonth: monthStart,
      status: { in: ["project_closed", "accounting_closed"] },
    },
    select: { id: true },
  });

  return !!record;
}

// ============================================
// 11. getTransactionFormData
// ============================================

export async function getTransactionFormData(): Promise<TransactionFormData> {
  const [
    counterparties,
    expenseCategories,
    costCenters,
    allocationTemplates,
    paymentMethods,
    contracts,
  ] = await Promise.all([
    // 取引先
    prisma.counterparty.findMany({
      where: { deletedAt: null, mergedIntoId: null, isActive: true },
      select: { id: true, name: true, counterpartyType: true },
      orderBy: { name: "asc" },
    }),

    // 費目
    prisma.expenseCategory.findMany({
      where: { deletedAt: null, isActive: true },
      select: { id: true, name: true, type: true },
      orderBy: { displayOrder: "asc" },
    }),

    // 按分先
    prisma.costCenter.findMany({
      where: { deletedAt: null, isActive: true },
      select: { id: true, name: true, projectId: true },
      orderBy: { name: "asc" },
    }),

    // 按分テンプレート
    prisma.allocationTemplate.findMany({
      where: { deletedAt: null, isActive: true },
      include: {
        lines: {
          include: {
            costCenter: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { name: "asc" },
    }),

    // 決済手段
    prisma.paymentMethod.findMany({
      where: { deletedAt: null, isActive: true },
      select: { id: true, name: true, methodType: true },
      orderBy: { name: "asc" },
    }),

    // 契約一覧（取引先との紐づけ用にcompanyIdを保持）
    prisma.masterContract.findMany({
      select: {
        id: true,
        title: true,
        companyId: true,
        company: { select: { id: true, name: true } },
        endDate: true,
      },
      orderBy: { id: "desc" },
      take: 500,
    }),
  ]);

  return {
    counterparties,
    expenseCategories,
    costCenters,
    allocationTemplates: allocationTemplates.map((t) => ({
      id: t.id,
      name: t.name,
      lines: t.lines.map((l) => ({
        id: l.id,
        costCenterId: l.costCenterId,
        allocationRate: l.allocationRate,
        label: l.label,
        costCenter: l.costCenter,
      })),
    })),
    paymentMethods,
    contracts,
  };
}
