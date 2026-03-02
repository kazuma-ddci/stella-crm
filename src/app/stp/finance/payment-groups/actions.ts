"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { requireEdit, getSession } from "@/lib/auth";
import { hasPermission } from "@/lib/auth";
import { recordChangeLog } from "@/app/accounting/changelog/actions";
import { requireStpProjectId } from "@/lib/project-context";
import { toLocalDateString } from "@/lib/utils";
import { createNotificationBulk } from "@/lib/notifications/create-notification";
import type { UserPermission } from "@/types/auth";

// ============================================
// ステータス遷移マップ
// ============================================

const INVOICE_TRANSITIONS: Record<string, string[]> = {
  before_request: ["requested"],
  requested: ["invoice_received"],
  invoice_received: ["confirmed", "rejected"],
  rejected: ["re_requested"],
  re_requested: ["invoice_received"],
  confirmed: ["awaiting_accounting", "paid"],
  awaiting_accounting: ["paid", "returned"],
  returned: ["confirmed"],
};

const DIRECT_TRANSITIONS: Record<string, string[]> = {
  unprocessed: ["confirmed"],
  confirmed: ["awaiting_accounting", "paid"],
  awaiting_accounting: ["paid", "returned"],
  returned: ["confirmed"],
};

function getTransitionsForType(paymentType: string): Record<string, string[]> {
  return paymentType === "direct" ? DIRECT_TRANSITIONS : INVOICE_TRANSITIONS;
}

// ============================================
// 機密フィルタヘルパー
// ============================================

function buildConfidentialFilter(userId: number, permissions: UserPermission[]) {
  if (hasPermission(permissions, "accounting", "edit")) return {};
  return { OR: [{ isConfidential: false }, { isConfidential: true, createdBy: userId }] };
}

// ============================================
// 型定義（types.ts から再エクスポート）
// ============================================

import type {
  PaymentGroupListItem,
  UngroupedAllocationItem,
  UngroupedExpenseTransaction,
  PaymentGroupTransaction,
} from "./types";

export type {
  PaymentGroupListItem,
  UngroupedAllocationItem,
  UngroupedExpenseTransaction,
  PaymentGroupTransaction,
} from "./types";

// ============================================
// 一覧取得
// ============================================

export async function getPaymentGroups(
  projectId?: number
): Promise<PaymentGroupListItem[]> {
  const session = await getSession();
  const confidentialFilter = buildConfidentialFilter(session.id, session.permissions);

  const records = await prisma.paymentGroup.findMany({
    where: { deletedAt: null, ...(projectId ? { projectId } : {}), ...confidentialFilter },
    include: {
      counterparty: true,
      operatingCompany: true,
      transactions: { where: { deletedAt: null }, select: { id: true } },
      allocationItems: { select: { id: true } },
      creator: true,
      confirmer: true,
      expectedInboundEmail: { select: { email: true } },
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
  });

  return records.map((r) => ({
    id: r.id,
    referenceCode: r.referenceCode,
    counterpartyId: r.counterpartyId,
    counterpartyName: r.counterparty.name,
    operatingCompanyId: r.operatingCompanyId,
    operatingCompanyName: r.operatingCompany.companyName,
    targetMonth: r.targetMonth ? toLocalDateString(r.targetMonth).slice(0, 7) : null,
    expectedPaymentDate:
      r.expectedPaymentDate ? toLocalDateString(r.expectedPaymentDate) : null,
    paymentDueDate:
      r.paymentDueDate ? toLocalDateString(r.paymentDueDate) : null,
    actualPaymentDate:
      r.actualPaymentDate ? toLocalDateString(r.actualPaymentDate) : null,
    totalAmount: r.totalAmount,
    taxAmount: r.taxAmount,
    receivedPdfPath: r.receivedPdfPath,
    receivedPdfFileName: r.receivedPdfFileName,
    paymentType: r.paymentType as "invoice" | "direct",
    isConfidential: r.isConfidential,
    status: r.status,
    confirmedByName: r.confirmer?.name ?? null,
    confirmedAt: r.confirmedAt ? toLocalDateString(r.confirmedAt) : null,
    expectedInboundEmail: r.expectedInboundEmail ? { email: r.expectedInboundEmail.email } : null,
    transactionCount: r.transactions.length,
    allocationItemCount: r.allocationItems.length,
    createdByName: r.creator.name,
    createdAt: toLocalDateString(r.createdAt),
  }));
}

// ============================================
// 未グループ化の経費取引を取得
// ============================================

export async function getUngroupedExpenseTransactions(
  counterpartyId?: number,
  projectId?: number
): Promise<UngroupedExpenseTransaction[]> {
  const session = await getSession();
  const txConfidentialFilter = buildConfidentialFilter(session.id, session.permissions);

  const where: Record<string, unknown> = {
    deletedAt: null,
    type: "expense",
    status: "confirmed",
    paymentGroupId: null,
    allocationTemplateId: null, // 按分取引は除外（AllocationGroupItem経由で処理）
    ...(projectId ? { projectId } : {}),
    ...txConfidentialFilter,
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
    periodFrom: toLocalDateString(r.periodFrom),
    periodTo: toLocalDateString(r.periodTo),
    note: r.note,
    isConfidential: r.isConfidential,
  }));
}

// ============================================
// 未処理の按分取引（経費側）
// ============================================

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

  // 按分テンプレートを持つ confirmed 経費取引を取得
  const transactions = await prisma.transaction.findMany({
    where: {
      deletedAt: null,
      type: "expense",
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
          paymentGroup: { select: { id: true } },
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
        .filter((i) => i.groupType === "payment")
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
            (i) => i.costCenterId === l.costCenterId && i.groupType === "payment"
          );
          let groupLabel: string | null = null;
          if (item?.paymentGroup) {
            groupLabel = `支払 #${item.paymentGroup.id}`;
          }
          return {
            costCenterName: l.costCenter?.name ?? "不明",
            groupLabel,
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

export async function createPaymentGroup(data: {
  counterpartyId: number;
  operatingCompanyId: number;
  expectedPaymentDate?: string | null;
  paymentDueDate?: string | null;
  transactionIds: number[];
  projectId?: number;
  paymentType?: "invoice" | "direct";
  isConfidential?: boolean;
}): Promise<{ id: number }> {
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
      throw new Error("按分取引は直接支払に所属できません。按分明細として追加してください。");
    }

    // 選択された取引を検証（projectIdでスコープ）
    const transactions = await tx.transaction.findMany({
      where: {
        id: { in: data.transactionIds },
        deletedAt: null,
        status: "confirmed",
        paymentGroupId: null,
        type: "expense",
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
      throw new Error(
        "異なる取引先の取引は同じ支払に入れられません"
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

    // PaymentGroup作成（サーバー側で取得したprojectIdを使用）
    const paymentType = data.paymentType ?? "invoice";
    const initialStatus = paymentType === "direct" ? "unprocessed" : "before_request";

    const group = await tx.paymentGroup.create({
      data: {
        counterpartyId: data.counterpartyId,
        operatingCompanyId: data.operatingCompanyId,
        expectedPaymentDate: data.expectedPaymentDate
          ? new Date(data.expectedPaymentDate)
          : null,
        paymentDueDate: data.paymentDueDate
          ? new Date(data.paymentDueDate)
          : data.expectedPaymentDate
          ? new Date(data.expectedPaymentDate)
          : null,
        totalAmount: subtotal + taxTotal,
        taxAmount: taxTotal,
        projectId: stpProjectId,
        paymentType,
        isConfidential: data.isConfidential ?? false,
        status: initialStatus,
        createdBy: user.id,
      },
    });

    // referenceCode を設定（PG-0001 形式）
    const code = `PG-${String(group.id).padStart(4, '0')}`;
    await tx.paymentGroup.update({
      where: { id: group.id },
      data: { referenceCode: code },
    });

    // 取引をグループに紐づけ（projectIdでスコープ）
    await tx.transaction.updateMany({
      where: { id: { in: transactions.map((t) => t.id) }, projectId: stpProjectId },
      data: { paymentGroupId: group.id },
    });

    await recordChangeLog({
      tableName: "PaymentGroup",
      recordId: group.id,
      changeType: "create",
      newData: { status: initialStatus, paymentType, counterpartyId: data.counterpartyId, operatingCompanyId: data.operatingCompanyId },
    }, user.id, tx);

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
    paymentDueDate?: string | null;
    actualPaymentDate?: string | null;
    isConfidential?: boolean;
  }
): Promise<void> {
  const user = await requireEdit("stp");
  const stpProjectId = await requireStpProjectId();

  // actualPaymentDate の更新は経理権限が必要
  if ("actualPaymentDate" in data) {
    const session = await getSession();
    if (!hasPermission(session.permissions, "accounting", "edit")) {
      throw new Error("実際の支払日の変更は経理権限が必要です");
    }
  }

  const group = await prisma.paymentGroup.findUnique({
    where: { id, deletedAt: null, projectId: stpProjectId },
  });
  if (!group) throw new Error("支払が見つかりません");

  // actualPaymentDate のみの更新は confirmed/awaiting_accounting でも許可（経理権限チェック済み）
  const onlyActualPaymentDate =
    Object.keys(data).length === 1 && "actualPaymentDate" in data;
  // isConfidential のみの更新は編集可能ステータス外でも許可（paid以前のすべて）
  const onlyIsConfidential =
    Object.keys(data).length === 1 && "isConfidential" in data;

  // 編集可能ステータスの判定（paymentTypeに応じて分岐）
  const editableStatuses = group.paymentType === "direct"
    ? ["unprocessed"]
    : ["before_request", "rejected", "invoice_received"];

  if (
    !onlyActualPaymentDate &&
    !onlyIsConfidential &&
    !editableStatuses.includes(group.status)
  ) {
    throw new Error("このステータスでは編集できません");
  }

  const oldData: Record<string, unknown> = {};
  const newData: Record<string, unknown> = {};
  const updateData: Record<string, unknown> = {
    updatedBy: user.id,
  };

  if ("expectedPaymentDate" in data) {
    oldData.expectedPaymentDate = group.expectedPaymentDate ? toLocalDateString(group.expectedPaymentDate) : null;
    newData.expectedPaymentDate = data.expectedPaymentDate ?? null;
    updateData.expectedPaymentDate = data.expectedPaymentDate
      ? new Date(data.expectedPaymentDate)
      : null;
  }
  if ("paymentDueDate" in data) {
    oldData.paymentDueDate = group.paymentDueDate ? toLocalDateString(group.paymentDueDate) : null;
    newData.paymentDueDate = data.paymentDueDate ?? null;
    updateData.paymentDueDate = data.paymentDueDate
      ? new Date(data.paymentDueDate)
      : null;
  }
  if ("actualPaymentDate" in data) {
    oldData.actualPaymentDate = group.actualPaymentDate ? toLocalDateString(group.actualPaymentDate) : null;
    newData.actualPaymentDate = data.actualPaymentDate ?? null;
    updateData.actualPaymentDate = data.actualPaymentDate
      ? new Date(data.actualPaymentDate)
      : null;
  }
  if ("isConfidential" in data && data.isConfidential !== undefined) {
    oldData.isConfidential = group.isConfidential;
    newData.isConfidential = data.isConfidential;
    updateData.isConfidential = data.isConfidential;
  }

  await prisma.paymentGroup.update({
    where: { id },
    data: updateData,
  });

  await recordChangeLog({
    tableName: "PaymentGroup",
    recordId: id,
    changeType: "update",
    oldData,
    newData,
  }, user.id);

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
  const stpProjectId = await requireStpProjectId();

  const group = await prisma.paymentGroup.findUnique({
    where: { id, deletedAt: null, projectId: stpProjectId },
  });
  if (!group) throw new Error("支払が見つかりません");

  // 削除可能ステータスの分岐
  const deletableStatus = group.paymentType === "direct" ? "unprocessed" : "before_request";
  if (group.status !== deletableStatus) {
    throw new Error(
      group.paymentType === "direct"
        ? "「未処理」ステータスの支払のみ削除できます"
        : "「依頼前」ステータスの支払のみ削除できます"
    );
  }

  await prisma.$transaction(async (tx) => {
    if (deleteTransactions) {
      // 紐づく取引も論理削除（projectIdでスコープ）
      await tx.transaction.updateMany({
        where: { paymentGroupId: id, deletedAt: null, projectId: stpProjectId },
        data: { deletedAt: new Date(), paymentGroupId: null },
      });
    } else {
      // 取引のグループ紐付けを解除（projectIdでスコープ）
      await tx.transaction.updateMany({
        where: { paymentGroupId: id, projectId: stpProjectId },
        data: { paymentGroupId: null },
      });
    }

    // 論理削除
    await tx.paymentGroup.update({
      where: { id },
      data: { deletedAt: new Date(), updatedBy: user.id },
    });

    await recordChangeLog({
      tableName: "PaymentGroup",
      recordId: id,
      changeType: "delete",
      oldData: { status: group.status },
    }, user.id, tx);
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
  const stpProjectId = await requireStpProjectId();

  const group = await prisma.paymentGroup.findUnique({
    where: { id: paymentGroupId, deletedAt: null, projectId: stpProjectId },
  });
  if (!group) throw new Error("支払が見つかりません");

  if (group.paymentType !== "invoice") {
    throw new Error("請求書ベースの支払のみ発行依頼できます");
  }

  if (group.status !== "before_request") {
    throw new Error(
      "「依頼前」ステータスの支払のみ請求書発行依頼できます"
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
  const stpProjectId = await requireStpProjectId();

  const group = await prisma.paymentGroup.findUnique({
    where: { id: paymentGroupId, deletedAt: null, projectId: stpProjectId },
  });
  if (!group) throw new Error("支払が見つかりません");

  if (group.paymentType !== "invoice") {
    throw new Error("請求書ベースの支払のみ確認できます");
  }

  if (group.status !== "invoice_received") {
    throw new Error(
      "「請求書受領済み」ステータスの支払のみ確認できます"
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

  await recordChangeLog({
    tableName: "PaymentGroup",
    recordId: paymentGroupId,
    changeType: "update",
    oldData: { status: group.status },
    newData: { status: "confirmed" },
  }, user.id);

  revalidatePath("/stp/finance/payment-groups");
}

// ============================================
// 即時支払い確認（direct: unprocessed → confirmed）
// ============================================

export async function confirmDirectPayment(
  paymentGroupId: number
): Promise<void> {
  const user = await requireEdit("stp");
  const stpProjectId = await requireStpProjectId();

  const group = await prisma.paymentGroup.findUnique({
    where: { id: paymentGroupId, deletedAt: null, projectId: stpProjectId },
  });
  if (!group) throw new Error("支払が見つかりません");

  if (group.paymentType !== "direct") {
    throw new Error("即時支払いタイプの支払のみ確認できます");
  }

  if (group.status !== "unprocessed") {
    throw new Error("「未処理」ステータスの支払のみ確認できます");
  }

  const updateData: Record<string, unknown> = {
    status: "confirmed",
    confirmedBy: user.id,
    confirmedAt: new Date(),
    updatedBy: user.id,
  };

  await prisma.paymentGroup.update({
    where: { id: paymentGroupId },
    data: updateData,
  });

  await recordChangeLog({
    tableName: "PaymentGroup",
    recordId: paymentGroupId,
    changeType: "update",
    oldData: { status: group.status },
    newData: { status: "confirmed" },
  }, user.id);

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
  const stpProjectId = await requireStpProjectId();

  const group = await prisma.paymentGroup.findUnique({
    where: { id: paymentGroupId, deletedAt: null, projectId: stpProjectId },
  });
  if (!group) throw new Error("支払が見つかりません");

  if (group.paymentType !== "invoice") {
    throw new Error("請求書ベースの支払のみ差し戻しできます");
  }

  if (group.status !== "invoice_received") {
    throw new Error(
      "「請求書受領済み」ステータスの支払のみ差し戻しできます"
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

    await recordChangeLog({
      tableName: "PaymentGroup",
      recordId: paymentGroupId,
      changeType: "update",
      oldData: { status: group.status },
      newData: { status: "rejected" },
    }, user.id, tx);
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
  const stpProjectId = await requireStpProjectId();

  const group = await prisma.paymentGroup.findUnique({
    where: { id, deletedAt: null, projectId: stpProjectId },
  });
  if (!group) throw new Error("支払が見つかりません");

  // 遷移バリデーション（paymentTypeに応じてマップを選択）
  const validTransitions = getTransitionsForType(group.paymentType);
  const allowed = validTransitions[group.status] ?? [];
  if (!allowed.includes(newStatus)) {
    throw new Error(
      `ステータスを「${group.status}」から「${newStatus}」に変更できません`
    );
  }

  // invoice_received への遷移には証憑が必須
  if (newStatus === "invoice_received") {
    const attachmentCount = await prisma.attachment.count({
      where: { paymentGroupId: id, deletedAt: null },
    });
    if (attachmentCount === 0) {
      throw new Error(
        "請求書受領を記録するには、証憑（請求書ファイル）を先にアップロードしてください"
      );
    }
  }

  const updateData: Record<string, unknown> = {
    status: newStatus,
    updatedBy: user.id,
  };

  // paid に遷移する場合: 既に設定済みならそのまま、未設定ならexpectedPaymentDateをデフォルト
  if (newStatus === "paid" && !group.actualPaymentDate) {
    updateData.actualPaymentDate = group.expectedPaymentDate
      ?? new Date(toLocalDateString(new Date()));
  }

  await prisma.paymentGroup.update({
    where: { id },
    data: updateData,
  });

  await recordChangeLog({
    tableName: "PaymentGroup",
    recordId: id,
    changeType: "update",
    oldData: { status: group.status },
    newData: { status: newStatus },
  }, user.id);

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
  const stpProjectId = await requireStpProjectId();

  const group = await prisma.paymentGroup.findUnique({
    where: { id: groupId, deletedAt: null, projectId: stpProjectId },
    include: { transactions: { where: { deletedAt: null } } },
  });
  if (!group) throw new Error("支払が見つかりません");

  // 追加可能ステータスの分岐
  const addableStatuses = group.paymentType === "direct"
    ? ["unprocessed"]
    : ["before_request", "rejected"];
  if (!addableStatuses.includes(group.status)) {
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
    throw new Error("按分取引は直接支払に所属できません。按分明細として追加してください。");
  }

  // 追加する取引を検証（projectIdでスコープ）
  const transactions = await prisma.transaction.findMany({
    where: {
      id: { in: transactionIds },
      deletedAt: null,
      status: "confirmed",
      paymentGroupId: null,
      type: "expense",
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

    await recordChangeLog({
      tableName: "PaymentGroup",
      recordId: groupId,
      changeType: "update",
      newData: { addedTransactionIds: transactions.map((t) => t.id) },
    }, user.id, tx);
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
  const stpProjectId = await requireStpProjectId();

  const group = await prisma.paymentGroup.findUnique({
    where: { id: groupId, deletedAt: null, projectId: stpProjectId },
    include: { transactions: { where: { deletedAt: null } } },
  });
  if (!group) throw new Error("支払が見つかりません");

  // 削除可能ステータスの分岐
  const removableStatuses = group.paymentType === "direct"
    ? ["unprocessed"]
    : ["before_request", "rejected"];
  if (!removableStatuses.includes(group.status)) {
    throw new Error("このステータスでは取引を削除できません");
  }

  await prisma.$transaction(async (tx) => {
    // 取引のグループ紐付けを解除（所属グループ+projectIdを検証）
    await tx.transaction.update({
      where: { id: transactionId, paymentGroupId: groupId, projectId: stpProjectId },
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

    await recordChangeLog({
      tableName: "PaymentGroup",
      recordId: groupId,
      changeType: "update",
      newData: { removedTransactionIds: [transactionId] },
    }, user.id, tx);
  });

  revalidatePath("/stp/finance/payment-groups");
  revalidatePath("/stp/finance/transactions");
}

// ============================================
// グループ内取引の取得
// ============================================

export async function getPaymentGroupTransactions(
  groupId: number
): Promise<PaymentGroupTransaction[]> {
  const stpProjectId = await requireStpProjectId();

  // グループがSTPプロジェクトに属することを検証
  const group = await prisma.paymentGroup.findUnique({
    where: { id: groupId, deletedAt: null, projectId: stpProjectId },
    select: { id: true },
  });
  if (!group) throw new Error("支払が見つかりません");

  const records = await prisma.transaction.findMany({
    where: { paymentGroupId: groupId, deletedAt: null, projectId: stpProjectId },
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
    periodFrom: toLocalDateString(r.periodFrom),
    periodTo: toLocalDateString(r.periodTo),
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
  const stpProjectId = await requireStpProjectId();

  const group = await prisma.paymentGroup.findUnique({
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
  if (!group) throw new Error("支払が見つかりません");

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

// ============================================
// 証憑管理
// ============================================

export async function getPaymentGroupAttachments(groupId: number) {
  await requireEdit("stp");
  const attachments = await prisma.attachment.findMany({
    where: { paymentGroupId: groupId, deletedAt: null },
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

export async function addPaymentGroupAttachments(
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
      paymentGroupId: groupId,
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

  await recordChangeLog({
    tableName: "PaymentGroup",
    recordId: groupId,
    changeType: "update",
    newData: { addedAttachments: files.map((f) => f.generatedName ?? f.fileName) },
  }, session.id);

  revalidatePath("/stp/finance/payment-groups");
}

export async function deletePaymentGroupAttachment(attachmentId: number) {
  const session = await requireEdit("stp");

  const attachment = await prisma.attachment.findUnique({
    where: { id: attachmentId },
    select: { fileName: true, paymentGroupId: true },
  });

  await prisma.attachment.update({
    where: { id: attachmentId },
    data: { deletedAt: new Date() },
  });

  if (attachment?.paymentGroupId) {
    await recordChangeLog({
      tableName: "PaymentGroup",
      recordId: attachment.paymentGroupId,
      changeType: "update",
      newData: { deletedAttachment: attachment.fileName },
    }, session.id);
  }

  revalidatePath("/stp/finance/payment-groups");
}

// ============================================
// 未確定取引（取引先別）
// ============================================

// ============================================
// 差し戻し依頼（STP → 経理）
// ============================================

export async function requestReturnPaymentGroup(
  id: number,
  data: { body: string }
): Promise<void> {
  const user = await requireEdit("stp");
  const stpProjectId = await requireStpProjectId();

  const group = await prisma.paymentGroup.findUnique({
    where: { id, deletedAt: null, projectId: stpProjectId },
  });
  if (!group) throw new Error("支払が見つかりません");

  if (!["awaiting_accounting", "paid"].includes(group.status)) {
    throw new Error("このステータスでは差し戻し依頼できません");
  }

  if (!data.body.trim()) {
    throw new Error("差し戻し理由を入力してください");
  }

  await prisma.transactionComment.create({
    data: {
      paymentGroupId: id,
      body: data.body.trim(),
      commentType: "return",
      returnReasonType: "correction_request",
      createdBy: user.id,
    },
  });

  // 経理権限を持つスタッフに通知
  const accountingProject = await prisma.masterProject.findFirst({
    where: { code: "accounting" },
  });
  if (accountingProject) {
    const permissions = await prisma.staffPermission.findMany({
      where: {
        projectId: accountingProject.id,
        permissionLevel: { in: ["edit", "admin"] },
      },
      select: { staffId: true },
    });
    const recipientIds = permissions.map((p) => p.staffId);
    if (recipientIds.length > 0) {
      await createNotificationBulk(recipientIds, {
        senderType: "staff",
        senderId: user.id,
        category: "accounting",
        title: `差し戻し依頼: 支払グループ #${id}`,
        message: data.body.trim(),
        linkUrl: "/accounting/batch-complete",
      });
    }
  }

  revalidatePath("/stp/finance/payment-groups");
}

// ============================================
// 未確定取引（取引先別）
// ============================================

export async function getUnconfirmedExpenseTransactions(
  projectId?: number
): Promise<UngroupedExpenseTransaction[]> {
  const session = await getSession();
  const txConfidentialFilter = buildConfidentialFilter(session.id, session.permissions);

  const records = await prisma.transaction.findMany({
    where: {
      deletedAt: null,
      type: "expense",
      status: "unconfirmed",
      ...(projectId ? { projectId } : {}),
      ...txConfidentialFilter,
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
    periodFrom: toLocalDateString(r.periodFrom),
    periodTo: toLocalDateString(r.periodTo),
    note: r.note,
    isConfidential: r.isConfidential,
  }));
}
