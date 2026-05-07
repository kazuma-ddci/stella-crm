import { prisma } from "@/lib/prisma";

// Prisma の トランザクションクライアント型
export type TxClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

// ============================================
// InvoiceGroup の actualPaymentDate を StpRevenueRecord.paidDate に同期
// ============================================
//
// InvoiceGroupに紐づく Transaction (revenue) が StpRevenueRecord と対応している場合、
// actualPaymentDate を変更したら StpRevenueRecord.paidDate と status も連動させる必要がある。
// 経理側 (workflow) と STP側 (invoices) の両方から呼ばれる。
//
export async function syncPaymentDateToRevenueRecords(
  tx: TxClient,
  invoiceGroupId: number,
  paymentDate: Date | null
): Promise<void> {
  // InvoiceGroupに紐づくTransactionを取得
  const transactions = await tx.transaction.findMany({
    where: {
      invoiceGroupId,
      type: "revenue",
      deletedAt: null,
      stpContractHistoryId: { not: null },
    },
    select: {
      stpContractHistoryId: true,
      stpRevenueType: true,
      periodFrom: true,
    },
  });

  if (transactions.length === 0) return;

  // 各Transactionに対応するStpRevenueRecordを特定して更新
  for (const txn of transactions) {
    if (!txn.stpContractHistoryId || !txn.stpRevenueType) continue;

    // targetMonthはperiodFromの月初日で統一されている
    const targetMonth = new Date(
      txn.periodFrom.getFullYear(),
      txn.periodFrom.getMonth(),
      1
    );

    await tx.stpRevenueRecord.updateMany({
      where: {
        contractHistoryId: txn.stpContractHistoryId,
        revenueType: txn.stpRevenueType,
        targetMonth,
        deletedAt: null,
      },
      data: {
        paidDate: paymentDate,
        ...(paymentDate
          ? { status: "paid" }
          : { status: "invoiced" }),
      },
    });
  }
}

// ============================================
// InvoiceGroup の actualPaymentDate を receipts の最大日付で再計算
// 入金記録の追加・更新・削除のたびに呼ぶ
// ============================================
//
// 戻り値: 更新後の actualPaymentDate
//
export async function recalcInvoiceGroupActualPaymentDate(
  tx: TxClient,
  invoiceGroupId: number
): Promise<Date | null> {
  const latest = await tx.invoiceGroupReceipt.findFirst({
    where: { invoiceGroupId },
    orderBy: { receivedDate: "desc" },
    select: { receivedDate: true },
  });

  const newDate = latest?.receivedDate ?? null;

  await tx.invoiceGroup.update({
    where: { id: invoiceGroupId },
    data: { actualPaymentDate: newDate },
  });

  // StpRevenueRecord にも同期
  await syncPaymentDateToRevenueRecords(tx, invoiceGroupId, newDate);

  return newDate;
}

// ============================================
// PaymentGroup の actualPaymentDate を payments の最大日付で再計算
// ============================================
export async function recalcPaymentGroupActualPaymentDate(
  tx: TxClient,
  paymentGroupId: number
): Promise<Date | null> {
  const latest = await tx.paymentGroupPayment.findFirst({
    where: { paymentGroupId },
    orderBy: { paidDate: "desc" },
    select: { paidDate: true },
  });

  const newDate = latest?.paidDate ?? null;

  await tx.paymentGroup.update({
    where: { id: paymentGroupId },
    data: { actualPaymentDate: newDate },
  });

  return newDate;
}

export async function syncInvoiceGroupPaymentStateFromRecords(
  tx: TxClient,
  invoiceGroupId: number
): Promise<void> {
  const [group, records] = await Promise.all([
    tx.invoiceGroup.findUnique({
      where: { id: invoiceGroupId },
      select: { status: true, statementLinkCompleted: true },
    }),
    tx.invoiceGroupReceipt.findMany({
      where: { invoiceGroupId },
      select: { amount: true, receivedDate: true },
    }),
  ]);
  if (!group) return;

  const manualPaymentStatus = group.statementLinkCompleted
    ? "completed"
    : records.length > 0
      ? "partial"
      : "unpaid";
  const status =
    group.status === "returned" || group.status === "corrected"
      ? group.status
      : manualPaymentStatus === "completed"
        ? "paid"
        : manualPaymentStatus === "partial"
          ? "partially_paid"
          : group.status === "paid" || group.status === "partially_paid"
            ? "awaiting_accounting"
            : group.status;

  await tx.invoiceGroup.update({
    where: { id: invoiceGroupId },
    data: { manualPaymentStatus, status },
  });
}

export async function syncPaymentGroupPaymentStateFromRecords(
  tx: TxClient,
  paymentGroupId: number
): Promise<void> {
  const [group, records] = await Promise.all([
    tx.paymentGroup.findUnique({
      where: { id: paymentGroupId },
      select: { status: true, statementLinkCompleted: true },
    }),
    tx.paymentGroupPayment.findMany({
      where: { paymentGroupId },
      select: { amount: true, paidDate: true },
    }),
  ]);
  if (!group) return;

  const manualPaymentStatus = group.statementLinkCompleted
    ? "completed"
    : records.length > 0
      ? "partial"
      : "unpaid";
  const status =
    group.status === "returned"
      ? group.status
      : manualPaymentStatus === "completed"
        ? "paid"
        : group.status === "paid"
          ? "awaiting_accounting"
          : group.status;

  await tx.paymentGroup.update({
    where: { id: paymentGroupId },
    data: { manualPaymentStatus, status },
  });
}

// ============================================
// 入金/支払の集計サマリ
// ============================================
//
// 状態判定:
//   - "none"      : 記録なし → 未入金/未支払
//   - "partial"   : 合計 < totalAmount → 一部入金/一部支払
//   - "complete"  : 合計 == totalAmount → 完了
//   - "over"      : 合計 > totalAmount → 過剰
//
export type ReceiptPaymentStatus = "none" | "partial" | "complete" | "over";

export type ReceiptPaymentSummary = {
  recordCount: number;
  totalReceived: number;       // 記録の合計金額
  remaining: number;           // totalAmount - totalReceived
  status: ReceiptPaymentStatus;
  latestDate: Date | null;
};

export function summarizeReceiptPayment(
  records: { amount: number; date: Date }[],
  totalAmount: number | null | undefined
): ReceiptPaymentSummary {
  const totalReceived = records.reduce((sum, r) => sum + r.amount, 0);
  const target = totalAmount ?? 0;
  const remaining = target - totalReceived;

  let status: ReceiptPaymentStatus;
  if (records.length === 0) status = "none";
  else if (totalReceived === target) status = "complete";
  else if (totalReceived < target) status = "partial";
  else status = "over";

  let latestDate: Date | null = null;
  for (const r of records) {
    if (!latestDate || r.date > latestDate) latestDate = r.date;
  }

  return { recordCount: records.length, totalReceived, remaining, status, latestDate };
}
