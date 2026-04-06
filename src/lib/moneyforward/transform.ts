// ============================================
// MoneyForward 取引データ → AccountingTransaction 変換
// ============================================

import { createHash } from "crypto";
import type { Prisma } from "@prisma/client";
import type { MFTransaction } from "./types";

type AccountingTransactionCreateInput =
  Prisma.AccountingTransactionUncheckedCreateInput;

/** MFの1取引をAccountingTransactionの作成データに変換 */
export function transformMFTransaction(
  tx: MFTransaction,
  operatingCompanyId: number
): AccountingTransactionCreateInput {
  const isOutgoing = tx.amount < 0;

  return {
    direction: isOutgoing ? "outgoing" : "incoming",
    transactionDate: new Date(tx.date),
    amount: Math.abs(tx.amount),
    counterpartyName: tx.content || "不明",
    description: [tx.large_category_name, tx.middle_category_name]
      .filter(Boolean)
      .join(" / ") || null,
    memo: tx.memo,
    bankAccountName: tx.account.name,
    balance: null,
    operatingCompanyId,
    source: "moneyforward",
    sourceService: tx.account.service_name,
    sourceTransactionId: String(tx.id),
    deduplicationHash: generateMFDeduplicationHash(tx),
    reconciliationStatus: "unmatched",
  };
}

/** MF取引の重複検知用ハッシュを生成 */
function generateMFDeduplicationHash(tx: MFTransaction): string {
  // MFの取引IDが一意なので、source + id で確実に重複検知できる
  const data = JSON.stringify({
    source: "moneyforward",
    id: tx.id,
    date: tx.date,
    amount: tx.amount,
    accountId: tx.account.id,
  });
  return createHash("sha256").update(data).digest("hex").slice(0, 16);
}
