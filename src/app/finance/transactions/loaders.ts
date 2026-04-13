"use server";

/**
 * Transaction 系の loader Server Action 集約。
 *
 * 「重い include を含む取得系」を集める。`actions.ts` の lean 取得系（getTransactionMinimal 等）
 * とは別ファイルとして分離することで、用途と責務を明確化する。
 *
 * Server Component（page.tsx）から直接呼んでもよいし、Client Component からは
 * `actions.ts` 側の wrapper（getTransactionForPreview 等）経由で呼ぶ（§4.3.3(d) 参照）。
 *
 * エラー契約: typed error を throw する
 *  - レコード未存在 → FinanceRecordNotFoundError
 *  - 権限不足 → FinanceForbiddenError
 *
 * 詳細: docs/finance-accounting-refactor-plan.md §4.3.4・§4.3.6
 */

import { prisma } from "@/lib/prisma";
import {
  requireFinanceTransactionAccess,
  FinanceRecordNotFoundError,
} from "@/lib/auth/finance-access";

/**
 * 取引詳細用ローダー。認可（per-record）+ 重い include を含む。
 *
 * 取引詳細ページ・編集ページ・プレビューモーダルから呼ばれる。
 */
export async function getTransactionForDetailPage(transactionId: number) {
  await requireFinanceTransactionAccess(transactionId, "view");

  const transaction = await prisma.transaction.findFirst({
    where: { id: transactionId, deletedAt: null },
    include: {
      counterparty: {
        select: { id: true, name: true, counterpartyType: true },
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
      allocationGroupItems: {
        include: {
          costCenter: { select: { id: true, name: true } },
          invoiceGroup: { select: { invoiceNumber: true } },
          paymentGroup: { select: { targetMonth: true } },
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
      invoiceGroup: {
        select: {
          id: true,
          invoiceNumber: true,
          attachments: { where: { deletedAt: null } },
        },
      },
      paymentGroup: {
        select: {
          id: true,
          targetMonth: true,
          attachments: { where: { deletedAt: null } },
        },
      },
      creator: { select: { id: true, name: true } },
      updater: { select: { id: true, name: true } },
      confirmer: { select: { id: true, name: true } },
      expenseOwners: {
        include: {
          staff: { select: { id: true, name: true } },
        },
      },
    },
  });

  if (!transaction) {
    // requireFinanceTransactionAccess で存在チェック済だが、競合削除等の境界ケース対応
    throw new FinanceRecordNotFoundError("Transaction", transactionId);
  }

  return transaction;
}
