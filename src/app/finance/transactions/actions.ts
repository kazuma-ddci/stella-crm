"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { requireStaffWithProjectPermission } from "@/lib/auth/staff-action";
import { autoConfirmCreatorAllocations, checkAndTransitionToAwaitingAccounting, sendAllocationNotifications } from "./allocation-actions";
import type { AllocationNotificationInfo } from "./allocation-actions";
import { createNotification } from "@/lib/notifications/create-notification";
import { toBoolean } from "@/lib/utils";
import { recordChangeLog, extractChanges, pickRecordData } from "@/app/finance/changelog/actions";
import { TRANSACTION_LOG_FIELDS } from "@/app/finance/changelog/log-fields";
import { ok, err, type ActionResult } from "@/lib/action-result";
import {
  validateTransactionData,
  buildConfidentialFilter,
  checkMonthlyClose,
} from "./_helpers";
import {
  FinanceRecordNotFoundError,
  FinanceForbiddenError,
} from "@/lib/auth/finance-access";

// ============================================
// 型定義
// ============================================

export type TransactionFormData = {
  counterparties: {
    id: number;
    name: string;
    displayId: string | null;
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
  staffOptions: { id: number; name: string }[];
  currentUserId: number;
  // 経理モード用：紐づけ可能なグループ
  invoiceGroups?: {
    id: number;
    invoiceNumber: string | null;
    counterparty: { id: number; name: string };
    totalAmount: number | null;
    status: string;
  }[];
  paymentGroups?: {
    id: number;
    referenceCode: string | null;
    counterparty: { id: number; name: string } | null;
    totalAmount: number | null;
    status: string;
  }[];
};

// バリデーション・機密フィルタ・月次クローズチェック helper は ./_helpers.ts に分離（"use server"非対応のため）

// ============================================
// 1. createTransaction
// ============================================

export async function createTransaction(
  data: Record<string, unknown>
): Promise<ActionResult<{ id: number }>> {
  try {
  const session = await getSession();
  const staffId = session.id;

  const validated = validateTransactionData(data);

  // 月次クローズチェック
  await checkMonthlyClose(validated.periodFrom, validated.periodTo);

  const projectId = data.projectId ? Number(data.projectId) : null;
  const paymentMethodId = data.paymentMethodId
    ? Number(data.paymentMethodId)
    : null;
  const paymentDueDate = data.paymentDueDate
    ? new Date(data.paymentDueDate as string)
    : null;
  const note = data.note ? (data.note as string).trim() || null : null;

  // 源泉徴収
  const isWithholdingTarget = toBoolean(data.isWithholdingTarget);
  const withholdingTaxRate = data.withholdingTaxRate
    ? Number(data.withholdingTaxRate)
    : null;
  const withholdingTaxAmount = data.withholdingTaxAmount
    ? Number(data.withholdingTaxAmount)
    : null;
  const netPaymentAmount = data.netPaymentAmount
    ? Number(data.netPaymentAmount)
    : null;

  // 機密フラグ
  const isConfidential = toBoolean(data.isConfidential);

  // 経費負担者
  const hasExpenseOwner = toBoolean(data.hasExpenseOwner);
  const expenseOwners = (data.expenseOwners as Array<{
    staffId?: number | null;
    customName?: string | null;
  }>) || [];

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
        projectId,
        paymentMethodId,
        paymentDueDate,
        note,
        sourceType: "manual",
        hasExpenseOwner,
        isWithholdingTarget,
        withholdingTaxRate,
        withholdingTaxAmount,
        netPaymentAmount,
        isConfidential,
        createdBy: staffId,
      },
    });

    // 経費負担者作成
    if (hasExpenseOwner && expenseOwners.length > 0) {
      await tx.transactionExpenseOwner.createMany({
        data: expenseOwners.map((o) => ({
          transactionId: transaction.id,
          staffId: o.staffId ?? null,
          customName: o.customName ?? null,
        })),
      });
    }

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

  return ok({ id: result.transaction.id });
  } catch (e) {
    console.error("[createTransaction] error:", e);
    return err(e instanceof Error ? e.message : "取引の作成に失敗しました");
  }
}

// ============================================
// 2. updateTransaction
// ============================================

export async function updateTransaction(
  id: number,
  data: Record<string, unknown>
): Promise<ActionResult> {
  try {
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

  const projectId = data.projectId ? Number(data.projectId) : null;
  const paymentMethodId = data.paymentMethodId
    ? Number(data.paymentMethodId)
    : null;
  const paymentDueDate = data.paymentDueDate
    ? new Date(data.paymentDueDate as string)
    : null;
  const note = data.note ? (data.note as string).trim() || null : null;

  // 源泉徴収
  const isWithholdingTarget = toBoolean(data.isWithholdingTarget);
  const withholdingTaxRate = data.withholdingTaxRate
    ? Number(data.withholdingTaxRate)
    : null;
  const withholdingTaxAmount = data.withholdingTaxAmount
    ? Number(data.withholdingTaxAmount)
    : null;
  const netPaymentAmount = data.netPaymentAmount
    ? Number(data.netPaymentAmount)
    : null;

  // 機密フラグ
  const isConfidential = toBoolean(data.isConfidential);

  // 経費負担者
  const hasExpenseOwner = toBoolean(data.hasExpenseOwner);
  const expenseOwners = (data.expenseOwners as Array<{
    staffId?: number | null;
    customName?: string | null;
  }>) || [];

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
        projectId,
        paymentMethodId,
        paymentDueDate,
        note,
        hasExpenseOwner,
        isWithholdingTarget,
        withholdingTaxRate,
        withholdingTaxAmount,
        netPaymentAmount,
        isConfidential,
        updatedBy: staffId,
      },
    });

    // 経費負担者の全入れ替え
    await tx.transactionExpenseOwner.deleteMany({
      where: { transactionId: id },
    });
    if (hasExpenseOwner && expenseOwners.length > 0) {
      await tx.transactionExpenseOwner.createMany({
        data: expenseOwners.map((o) => ({
          transactionId: id,
          staffId: o.staffId ?? null,
          customName: o.customName ?? null,
        })),
      });
    }

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
  revalidatePath("/stp/finance/transactions");
  return ok();
  } catch (e) {
    console.error("[updateTransaction] error:", e);
    return err(e instanceof Error ? e.message : "取引の更新に失敗しました");
  }
}

// ============================================
// 3. 取引詳細取得
// ============================================
//
// v6: getTransactionById は廃止され、用途別に以下に分割された:
// - Server Component から呼ぶ場合:
//   → finance/transactions/loaders.ts の getTransactionForDetailPage
//   → typed error (FinanceRecordNotFoundError) を直接 throw、呼び出し側で notFound() 変換
// - Client Component から呼ぶ場合:
//   → 下記の getTransactionForPreview（wrapper、Result<T> 形式）

/**
 * Client Component 向けの取引詳細取得ラッパー（§4.3.3(d) 規約）。
 *
 * loaders.ts の getTransactionForDetailPage を呼び出し、typed error を
 * Result<T> 形式に変換して返す。
 *
 * 呼び出し側（stp/finance/transactions/transaction-preview-modal.tsx 等）は
 * `result.ok` で分岐して UI を決める。
 */
export async function getTransactionForPreview(
  transactionId: number
): Promise<
  | { ok: true; data: Awaited<ReturnType<typeof import("./loaders").getTransactionForDetailPage>> }
  | { ok: false; reason: "not_found" | "forbidden" | "internal"; message: string }
> {
  try {
    const { getTransactionForDetailPage } = await import("./loaders");
    const data = await getTransactionForDetailPage(transactionId);
    return { ok: true, data };
  } catch (e) {
    if (e instanceof FinanceRecordNotFoundError) {
      return { ok: false, reason: "not_found", message: "取引が見つかりません" };
    }
    if (e instanceof FinanceForbiddenError) {
      return { ok: false, reason: "forbidden", message: "この取引にアクセスする権限がありません" };
    }
    console.error("[getTransactionForPreview] error:", e);
    return {
      ok: false,
      reason: "internal",
      message: e instanceof Error ? e.message : "予期しないエラーが発生しました",
    };
  }
}

// ============================================
// 4. getTransactionFormData
// ============================================

// ============================================
// ステータス遷移定義
// ============================================

const VALID_STATUS_TRANSITIONS: Record<string, string[]> = {
  unconfirmed: ["confirmed"],
  confirmed: ["unconfirmed", "awaiting_accounting", "returned"],
  awaiting_accounting: ["journalized", "returned"],
  returned: ["resubmitted"],
  resubmitted: ["awaiting_accounting"],
  journalized: ["partially_paid", "paid"],
  partially_paid: ["paid"],
  paid: ["hidden"],
};

// ============================================
// 機密フィルタヘルパー
// ============================================

// buildConfidentialFilter / checkMonthlyClose は ./_helpers.ts に分離

// ============================================
// 5. confirmTransaction（未確認→確認済み）
// ============================================

export async function confirmTransaction(id: number): Promise<ActionResult> {
  try {
  const session = await getSession();
  const staffId = session.id;

  const transaction = await prisma.transaction.findFirst({
    where: { id, deletedAt: null },
    select: { id: true, status: true, periodFrom: true, periodTo: true, projectId: true, expenseCategoryId: true },
  });
  if (!transaction) {
    throw new Error("取引が見つかりません");
  }

  if (transaction.status !== "unconfirmed") {
    throw new Error(
      `ステータス「${transaction.status}」の取引は確認できません（未確認の取引のみ確認可能です）`
    );
  }

  if (transaction.expenseCategoryId === null) {
    throw new Error("費目が未設定の取引は確定できません。先に費目を設定してください。");
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
  return ok();
  } catch (e) {
    console.error("[confirmTransaction] error:", e);
    return err(e instanceof Error ? e.message : "取引確定に失敗しました");
  }
}

// ============================================
// 5b. unconfirmTransaction（確認済み→未確認）
// ============================================

export async function unconfirmTransaction(id: number): Promise<ActionResult> {
  try {
  const session = await getSession();
  const staffId = session.id;

  const transaction = await prisma.transaction.findFirst({
    where: { id, deletedAt: null },
    select: {
      id: true,
      status: true,
      periodFrom: true,
      periodTo: true,
      invoiceGroupId: true,
      paymentGroupId: true,
    },
  });
  if (!transaction) {
    throw new Error("取引が見つかりません");
  }

  if (transaction.status !== "confirmed") {
    throw new Error(
      `ステータス「${transaction.status}」の取引は確定取消できません（確認済みの取引のみ確定取消可能です）`
    );
  }

  // 請求/支払に紐づいている場合はエラー
  if (transaction.invoiceGroupId) {
    throw new Error(
      "この取引は請求に紐づけられています。確定取消するには請求管理から紐づけを解除してください。"
    );
  }
  if (transaction.paymentGroupId) {
    throw new Error(
      "この取引は支払に紐づけられています。確定取消するには支払管理から紐づけを解除してください。"
    );
  }

  await checkMonthlyClose(transaction.periodFrom, transaction.periodTo);

  await prisma.$transaction(async (tx) => {
    await tx.transaction.update({
      where: { id },
      data: {
        status: "unconfirmed",
        confirmedBy: null,
        confirmedAt: null,
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
        newData: { status: "unconfirmed" },
      },
      staffId,
      tx
    );
  });

  revalidatePath("/accounting/transactions");
  return ok();
  } catch (e) {
    console.error("[unconfirmTransaction] error:", e);
    return err(e instanceof Error ? e.message : "確定取消に失敗しました");
  }
}

// ============================================
// 6. returnTransaction（確認済み/経理処理待ち→差し戻し）
// ============================================

export async function returnTransaction(
  id: number,
  data: { body: string; returnReasonType: string }
): Promise<ActionResult> {
  try {
  const session = await getSession();
  const staffId = session.id;

  const VALID_RETURN_REASONS = [
    "question",
    "correction_request",
    "approval_check",
    "other",
  ] as const;

  if (!data.body?.trim()) {
    return err("差し戻しコメントは必須です");
  }
  if (
    !data.returnReasonType ||
    !(VALID_RETURN_REASONS as readonly string[]).includes(data.returnReasonType)
  ) {
    return err("差し戻し理由の種別を選択してください");
  }

  const transaction = await prisma.transaction.findFirst({
    where: { id, deletedAt: null },
    select: { id: true, status: true, periodFrom: true, periodTo: true, projectId: true, createdBy: true },
  });
  if (!transaction) {
    return err("取引が見つかりません");
  }

  const allowedFrom = VALID_STATUS_TRANSITIONS[transaction.status] ?? [];
  if (!allowedFrom.includes("returned")) {
    return err(
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
  return ok();
  } catch (e) {
    console.error("[returnTransaction] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
}

// ============================================
// 7. resubmitTransaction（差し戻し→再提出）
// ============================================

export async function resubmitTransaction(
  id: number,
  body?: string
): Promise<ActionResult> {
  try {
  const session = await getSession();
  const staffId = session.id;

  const transaction = await prisma.transaction.findFirst({
    where: { id, deletedAt: null },
    select: { id: true, status: true, periodFrom: true, periodTo: true, projectId: true },
  });
  if (!transaction) {
    return err("取引が見つかりません");
  }

  if (transaction.status !== "returned") {
    return err(
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
  return ok();
  } catch (e) {
    console.error("[resubmitTransaction] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
}

// ============================================
// 7b. submitToAccountingTransaction（確認済み/再提出→経理処理待ち）
// ============================================

export async function submitToAccountingTransaction(id: number): Promise<ActionResult> {
  try {
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
    return err("取引が見つかりません");
  }

  // confirmed または resubmitted のみ許可
  if (transaction.status !== "confirmed" && transaction.status !== "resubmitted") {
    return err(
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
          return err(
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
  return ok();
  } catch (e) {
    console.error("[submitToAccountingTransaction] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
}

// ============================================
// 7c. deleteTransaction（論理削除）
// ============================================

export async function deleteTransaction(id: number): Promise<ActionResult> {
  try {
  const session = await getSession();
  const staffId = session.id;

  const transaction = await prisma.transaction.findFirst({
    where: { id, deletedAt: null },
    select: {
      id: true,
      status: true,
      periodFrom: true,
      periodTo: true,
      invoiceGroupId: true,
      paymentGroupId: true,
    },
  });
  if (!transaction) {
    return err("取引が見つかりません");
  }

  // 請求/支払に紐づいている場合はエラー
  if (transaction.invoiceGroupId) {
    return err(
      "この取引は請求に紐づけられています。削除するには請求管理から紐づけを解除してください。"
    );
  }
  if (transaction.paymentGroupId) {
    return err(
      "この取引は支払に紐づけられています。削除するには支払管理から紐づけを解除してください。"
    );
  }

  await checkMonthlyClose(transaction.periodFrom, transaction.periodTo);

  await prisma.$transaction(async (tx) => {
    await tx.transaction.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        updatedBy: staffId,
      },
    });

    // 変更履歴を記録
    await recordChangeLog(
      {
        tableName: "Transaction",
        recordId: id,
        changeType: "delete",
        oldData: { status: transaction.status },
      },
      staffId,
      tx
    );
  });

  revalidatePath("/accounting/transactions");
  revalidatePath("/stp/finance/transactions");
  return ok();
  } catch (e) {
    console.error("[deleteTransaction] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
}

// ============================================
// 8. hideTransaction（非表示 / 論理削除）
// ============================================

export async function hideTransaction(id: number): Promise<ActionResult> {
  try {
  const session = await getSession();
  const staffId = session.id;

  const transaction = await prisma.transaction.findFirst({
    where: { id, deletedAt: null },
    select: { id: true, status: true, periodFrom: true, periodTo: true, projectId: true },
  });
  if (!transaction) {
    return err("取引が見つかりません");
  }

  if (transaction.status !== "paid") {
    return err(
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
  return ok();
  } catch (e) {
    console.error("[hideTransaction] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
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
  await requireStaffWithProjectPermission([
    { project: "accounting", level: "view" },
  ]);
  const session = await getSession();
  const txConfidentialFilter = buildConfidentialFilter(session);

  const where: Record<string, unknown> = {
    deletedAt: null,
    status: { not: "hidden" },
    ...txConfidentialFilter,
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

  const transactions = await prisma.transaction.findMany({
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

  // Decimal → number 変換（Client Componentに渡すため）
  return transactions.map((t) => ({
    ...t,
    withholdingTaxRate: t.withholdingTaxRate != null ? Number(t.withholdingTaxRate) : null,
  }));
}

// 9b. getAccountingTransactions / 9c. createAccountingTransaction は
// src/app/accounting/transactions/accounting-actions.ts に分離（経理専用のため）

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
  await requireStaffWithProjectPermission([
    { project: "accounting", level: "view" },
    { project: "stp", level: "view" },
    { project: "hojo", level: "view" },
    { project: "srd", level: "view" },
    { project: "slp", level: "view" },
  ]);
  const [
    session,
    counterparties,
    expenseCategories,
    costCenters,
    allocationTemplates,
    paymentMethods,
    staffOptions,
  ] = await Promise.all([
    getSession(),

    // 取引先
    prisma.counterparty.findMany({
      where: { deletedAt: null, mergedIntoId: null, isActive: true },
      select: { id: true, name: true, displayId: true, counterpartyType: true },
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

    // スタッフ一覧（経費負担者選択用）
    prisma.masterStaff.findMany({
      where: { isActive: true, isSystemUser: false },
      select: { id: true, name: true },
      orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
    }),
  ]);

  // ログインユーザーがスタッフ一覧に含まれていなければ先頭に追加
  if (!staffOptions.find((s) => s.id === session.id)) {
    const current = await prisma.masterStaff.findUnique({
      where: { id: session.id },
      select: { id: true, name: true },
    });
    if (current) {
      staffOptions.unshift(current);
    }
  }

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
        allocationRate: Number(l.allocationRate),
        label: l.label,
        costCenter: l.costCenter,
      })),
    })),
    paymentMethods,
    staffOptions,
    currentUserId: session.id,
  };
}

// 12. getAccountingTransactionFormData は src/app/accounting/transactions/accounting-actions.ts に分離
