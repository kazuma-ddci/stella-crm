/**
 * Transaction 系 Server Action の共有 private ヘルパー。
 *
 * "use server" を付けないことで sync 関数も export 可能。
 * `finance/transactions/actions.ts` と `accounting/transactions/accounting-actions.ts` の両方から import する。
 */

import { hasPermission, isSystemAdmin, isFounder } from "@/lib/auth/permissions";
import { ensureMonthNotClosed } from "@/lib/finance/monthly-close";
import type { SessionUser } from "@/types/auth";

// ============================================
// バリデーション
// ============================================

const VALID_TYPES = ["revenue", "expense"] as const;
const VALID_TAX_TYPES = ["tax_included", "tax_excluded"] as const;

export function validateTransactionData(data: Record<string, unknown>) {
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
    if (expectedTax > 0 && Math.abs(taxAmount - expectedTax) / expectedTax > 0.2) {
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
  const projectId = data.projectId ? Number(data.projectId) : null;

  if (allocationTemplateId && costCenterId) {
    throw new Error("按分テンプレートとプロジェクトは同時に指定できません");
  }
  if (!allocationTemplateId && !costCenterId && !projectId) {
    throw new Error("按分テンプレートまたはプロジェクトのいずれかを指定してください");
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
// 機密フィルタ
// ============================================

export function buildConfidentialFilter(user: SessionUser) {
  if (isSystemAdmin(user) || isFounder(user)) return {};
  if (hasPermission(user.permissions, "accounting", "edit")) return {};
  return { OR: [{ isConfidential: false }, { isConfidential: true, createdBy: user.id }] };
}

// ============================================
// 月次クローズチェック
// ============================================

export async function checkMonthlyClose(periodFrom: Date, periodTo: Date) {
  const startMonth = new Date(periodFrom.getFullYear(), periodFrom.getMonth(), 1);
  const endMonth = new Date(periodTo.getFullYear(), periodTo.getMonth(), 1);

  const current = new Date(startMonth);
  while (current <= endMonth) {
    await ensureMonthNotClosed(current);
    current.setMonth(current.getMonth() + 1);
  }
}
