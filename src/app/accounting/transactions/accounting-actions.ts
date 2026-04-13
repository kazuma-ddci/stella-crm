"use server";

/**
 * 経理専用 Transaction Server Actions。
 *
 * これらの関数は経理モジュール（accounting view 必須）でのみ使われる：
 * - getAccountingTransactions: 経理側一覧（awaiting_accounting以降のみ）
 * - createAccountingTransaction: 経理側から取引作成（直接awaiting_accounting）
 * - getAccountingTransactionFormData: 経理モード用フォームデータ（請求/支払グループ含む）
 *
 * 共通の取引CRUD は src/app/finance/transactions/actions.ts を参照。
 */

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { ok, err, type ActionResult } from "@/lib/action-result";
import { toBoolean } from "@/lib/utils";
import { requireStaffForAccounting } from "@/lib/auth/staff-action";
import { recordChangeLog, pickRecordData } from "@/app/finance/changelog/actions";
import { TRANSACTION_LOG_FIELDS } from "@/app/finance/changelog/log-fields";
import {
  validateTransactionData,
  buildConfidentialFilter,
  checkMonthlyClose,
} from "@/app/finance/transactions/_helpers";
import {
  getTransactionFormData,
  type TransactionFormData,
} from "@/app/finance/transactions/actions";

const ACCOUNTING_VISIBLE_STATUSES = [
  "awaiting_accounting",
  "journalized",
  "partially_paid",
  "paid",
];

// ============================================
// getAccountingTransactions（経理側一覧取得 — awaiting_accounting以降のみ）
// ============================================

export async function getAccountingTransactions() {
  await requireStaffForAccounting("view");
  const session = await getSession();
  const txConfidentialFilter = buildConfidentialFilter(session);

  const transactions = await prisma.transaction.findMany({
    where: {
      deletedAt: null,
      status: { in: ACCOUNTING_VISIBLE_STATUSES },
      ...txConfidentialFilter,
    },
    include: {
      counterparty: { select: { id: true, name: true } },
      expenseCategory: { select: { id: true, name: true } },
      costCenter: { select: { id: true, name: true } },
      project: { select: { id: true, name: true, code: true } },
      confirmer: { select: { id: true, name: true } },
      allocationTemplate: { select: { id: true, name: true } },
      creator: { select: { id: true, name: true } },
    },
    orderBy: [{ periodFrom: "desc" }, { id: "desc" }],
  });

  return transactions.map((t) => ({
    ...t,
    withholdingTaxRate: t.withholdingTaxRate != null ? Number(t.withholdingTaxRate) : null,
  }));
}

// ============================================
// createAccountingTransaction（経理側から取引作成 — 直接awaiting_accountingで作成）
// ============================================

export async function createAccountingTransaction(
  data: Record<string, unknown>
): Promise<ActionResult<{ id: number }>> {
  try {
    await requireStaffForAccounting("edit");
    const session = await getSession();
    const staffId = session.id;

    const validated = validateTransactionData(data);

    // 月次クローズチェック
    await checkMonthlyClose(validated.periodFrom, validated.periodTo);

    const projectId = data.projectId ? Number(data.projectId) : null;
    const paymentMethodId = data.paymentMethodId ? Number(data.paymentMethodId) : null;
    const paymentDueDate = data.paymentDueDate
      ? new Date(data.paymentDueDate as string)
      : null;
    const note = data.note ? (data.note as string).trim() || null : null;

    // 源泉徴収
    const isWithholdingTarget = toBoolean(data.isWithholdingTarget);
    const withholdingTaxRate = data.withholdingTaxRate ? Number(data.withholdingTaxRate) : null;
    const withholdingTaxAmount = data.withholdingTaxAmount ? Number(data.withholdingTaxAmount) : null;
    const netPaymentAmount = data.netPaymentAmount ? Number(data.netPaymentAmount) : null;

    // 機密フラグ
    const isConfidential = toBoolean(data.isConfidential);

    // グループ紐づけ
    const invoiceGroupId = data.invoiceGroupId ? Number(data.invoiceGroupId) : null;
    const paymentGroupId = data.paymentGroupId ? Number(data.paymentGroupId) : null;

    // バリデーション: 請求グループは売上のみ、支払グループは経費のみ
    if (invoiceGroupId && validated.type !== "revenue") {
      return err("請求グループには売上取引のみ紐づけできます");
    }
    if (paymentGroupId && validated.type !== "expense") {
      return err("支払グループには経費取引のみ紐づけできます");
    }
    if (invoiceGroupId && paymentGroupId) {
      return err("請求グループと支払グループを同時に指定できません");
    }

    // グループの存在・ステータスチェック
    if (invoiceGroupId) {
      const group = await prisma.invoiceGroup.findFirst({
        where: { id: invoiceGroupId, deletedAt: null },
        select: { id: true, status: true },
      });
      if (!group) return err("指定された請求グループが見つかりません");
      if (!["awaiting_accounting", "partially_paid"].includes(group.status)) {
        return err("この請求グループには取引を追加できません（経理処理待ちまたは一部入金済みのみ可能）");
      }
    }
    if (paymentGroupId) {
      const group = await prisma.paymentGroup.findFirst({
        where: { id: paymentGroupId, deletedAt: null },
        select: { id: true, status: true },
      });
      if (!group) return err("指定された支払グループが見つかりません");
      if (!["awaiting_accounting", "confirmed"].includes(group.status)) {
        return err("この支払グループには取引を追加できません（経理処理待ちまたは確認済みのみ可能）");
      }
    }

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
          sourceType: "accounting",
          status: "awaiting_accounting",
          hasExpenseOwner: false,
          isWithholdingTarget,
          withholdingTaxRate,
          withholdingTaxAmount,
          netPaymentAmount,
          isConfidential,
          invoiceGroupId,
          paymentGroupId,
          createdBy: staffId,
          confirmedBy: staffId,
          confirmedAt: new Date(),
        },
      });

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

      return { transaction };
    });

    revalidatePath("/accounting/transactions");
    revalidatePath("/accounting/dashboard");

    return ok({ id: result.transaction.id });
  } catch (e) {
    console.error("[createAccountingTransaction] error:", e);
    return err(e instanceof Error ? e.message : "取引の作成に失敗しました");
  }
}

// ============================================
// getAccountingTransactionFormData（経理モード用）
// ============================================

export async function getAccountingTransactionFormData(): Promise<TransactionFormData> {
  await requireStaffForAccounting("view");
  const [baseFormData, invoiceGroups, paymentGroups] = await Promise.all([
    getTransactionFormData(),

    // 経理処理待ち以降の請求グループ
    prisma.invoiceGroup.findMany({
      where: {
        deletedAt: null,
        status: { in: ["awaiting_accounting", "partially_paid"] },
      },
      select: {
        id: true,
        invoiceNumber: true,
        totalAmount: true,
        status: true,
        counterparty: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),

    // 経理処理待ち以降の支払グループ
    prisma.paymentGroup.findMany({
      where: {
        deletedAt: null,
        status: { in: ["awaiting_accounting", "confirmed"] },
      },
      select: {
        id: true,
        referenceCode: true,
        totalAmount: true,
        status: true,
        counterparty: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
  ]);

  return {
    ...baseFormData,
    invoiceGroups,
    paymentGroups,
  };
}
