import type { Prisma } from "@prisma/client";
import {
  recalcInvoiceGroupActualPaymentDate,
  recalcPaymentGroupActualPaymentDate,
  syncInvoiceGroupPaymentStateFromRecords,
  syncPaymentGroupPaymentStateFromRecords,
} from "@/lib/accounting/sync-payment-date";

export type StatementLinkType = "settlement" | "fee";
export type StatementGroupKind = "invoice" | "payment";

export type StatementLinkAmountSummary = {
  linkCount: number;
  settlementAmount: number;
  feeAmount: number;
  allocatedAmount: number;
};

export function normalizeStatementLinkType(value: unknown): StatementLinkType {
  return value === "fee" ? "fee" : "settlement";
}

export function summarizeStatementLinks(
  links: { amount: number; linkType?: string | null }[]
): StatementLinkAmountSummary {
  return links.reduce<StatementLinkAmountSummary>(
    (summary, link) => {
      const amount = link.amount;
      if (normalizeStatementLinkType(link.linkType) === "fee") {
        summary.feeAmount += amount;
      } else {
        summary.settlementAmount += amount;
      }
      summary.allocatedAmount += amount;
      summary.linkCount += 1;
      return summary;
    },
    { linkCount: 0, settlementAmount: 0, feeAmount: 0, allocatedAmount: 0 }
  );
}

export function buildStatementCompletionWarnings(
  label: "入金" | "支払",
  summary: StatementLinkAmountSummary,
  recordAmount: number
): string[] {
  const warnings: string[] = [];
  if (summary.linkCount === 0) {
    warnings.push("入出金履歴が1件も紐付いていません。最低1件以上の紐付けが必要です。");
  }
  if (summary.settlementAmount === 0 && summary.feeAmount > 0) {
    warnings.push("手数料のみが紐付いています。通常の入出金履歴も紐付けてください。");
  }
  if (summary.settlementAmount !== recordAmount) {
    warnings.push(
      `${label}記録合計（¥${recordAmount.toLocaleString("ja-JP")}）と通常の入出金履歴紐付け金額（¥${summary.settlementAmount.toLocaleString("ja-JP")}）が一致していません。`
    );
  }
  return warnings;
}

export async function recalculateStatementLinkCompleted(
  tx: Prisma.TransactionClient,
  groupKind: StatementGroupKind,
  groupId: number
): Promise<boolean> {
  if (groupKind === "invoice") {
    await recalcInvoiceGroupActualPaymentDate(tx, groupId);
    const group = await tx.invoiceGroup.findFirst({
      where: { id: groupId, deletedAt: null },
      select: {
        receipts: { select: { amount: true } },
        bankStatementLinks: { select: { amount: true, linkType: true } },
      },
    });
    if (!group) return false;
    const recordAmount = group.receipts.reduce((sum, r) => sum + r.amount, 0);
    const summary = summarizeStatementLinks(group.bankStatementLinks);
    const completed =
      buildStatementCompletionWarnings("入金", summary, recordAmount).length === 0;
    await tx.invoiceGroup.update({
      where: { id: groupId },
      data: { statementLinkCompleted: completed },
    });
    await syncInvoiceGroupPaymentStateFromRecords(tx, groupId);
    return completed;
  }

  await recalcPaymentGroupActualPaymentDate(tx, groupId);
  const group = await tx.paymentGroup.findFirst({
    where: { id: groupId, deletedAt: null },
    select: {
      payments: { select: { amount: true } },
      bankStatementLinks: { select: { amount: true, linkType: true } },
    },
  });
  if (!group) return false;
  const recordAmount = group.payments.reduce((sum, p) => sum + p.amount, 0);
  const summary = summarizeStatementLinks(group.bankStatementLinks);
  const completed =
    buildStatementCompletionWarnings("支払", summary, recordAmount).length === 0;
  await tx.paymentGroup.update({
    where: { id: groupId },
    data: { statementLinkCompleted: completed },
  });
  await syncPaymentGroupPaymentStateFromRecords(tx, groupId);
  return completed;
}
