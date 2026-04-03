"use server";

import { prisma } from "@/lib/prisma";
import { toLocalDateString } from "@/lib/utils";

// ============================================
// 型定義
// ============================================

export type ContractTransactionStatus = {
  contractHistoryId: number;
  companyId: number;
  companyName: string;
  industryType: string;
  contractPlan: string;
  jobMedia: string | null;
  contractStartDate: string;
  contractEndDate: string | null;
  status: string;
  monthlyFee: number;
  performanceFee: number;
  initialFee: number;
  // 月別取引ステータスサマリー
  monthlyStatuses: MonthlyTransactionStatus[];
};

export type MonthlyTransactionStatus = {
  month: string; // "YYYY-MM"
  transactions: ContractTransaction[];
  // 集約ステータス（その月の全取引を総合判定）
  aggregateStatus: AggregateStatus;
};

export type ContractTransaction = {
  id: number;
  type: string; // "revenue" | "expense"
  stpRevenueType: string | null;
  stpExpenseType: string | null;
  amount: number;
  taxAmount: number;
  status: string;
  periodFrom: string;
  periodTo: string;
  counterpartyName: string;
  note: string | null;
  // グループ情報
  invoiceGroupId: number | null;
  invoiceGroupStatus: string | null;
  invoiceNumber: string | null;
  paymentGroupId: number | null;
  paymentGroupStatus: string | null;
  paymentGroupRef: string | null;
};

export type AggregateStatus =
  | "no_transactions"    // 取引未生成
  | "unconfirmed"        // 未確認あり
  | "confirmed"          // 確認済（未グループ）
  | "grouped"            // グループ済（処理中）
  | "awaiting_payment"   // 入金/支払待ち
  | "partially_paid"     // 一部入金/支払済
  | "completed";         // 全完了

function deriveAggregateStatus(transactions: ContractTransaction[]): AggregateStatus {
  if (transactions.length === 0) return "no_transactions";

  // 全取引のステータスを確認
  const hasUnconfirmed = transactions.some((t) => t.status === "unconfirmed");
  if (hasUnconfirmed) return "unconfirmed";

  const allPaid = transactions.every(
    (t) => t.status === "paid" || t.status === "hidden"
  );
  if (allPaid) return "completed";

  const hasPartiallyPaid = transactions.some((t) => t.status === "partially_paid");
  if (hasPartiallyPaid) return "partially_paid";

  // グループへの所属を確認
  const allGrouped = transactions.every(
    (t) => t.invoiceGroupId !== null || t.paymentGroupId !== null
  );

  if (allGrouped) {
    // グループのステータスを確認
    const groupStatuses = transactions.map((t) => {
      if (t.invoiceGroupStatus) return t.invoiceGroupStatus;
      if (t.paymentGroupStatus) return t.paymentGroupStatus;
      return t.status;
    });

    const hasSent = groupStatuses.some((s) =>
      ["sent", "awaiting_accounting", "requested", "invoice_received"].includes(s)
    );
    if (hasSent) return "awaiting_payment";

    return "grouped";
  }

  const someGrouped = transactions.some(
    (t) => t.invoiceGroupId !== null || t.paymentGroupId !== null
  );
  if (someGrouped) return "grouped";

  return "confirmed";
}

// ============================================
// 契約別ステータスマトリクス取得
// ============================================

export async function getContractStatusMatrix(params?: {
  targetMonths?: string[]; // ["2026-01", "2026-02", ...]
  companyId?: number;
  statusFilter?: AggregateStatus;
}): Promise<ContractTransactionStatus[]> {
  // 対象月の範囲を決定
  const now = new Date();
  const targetMonths = params?.targetMonths || generateMonthRange(now, 6);

  // アクティブな契約履歴を取得
  const contractHistories = await prisma.stpContractHistory.findMany({
    where: {
      deletedAt: null,
      ...(params?.companyId ? { companyId: params.companyId } : {}),
      status: { in: ["active", "scheduled"] },
    },
    include: {
      company: {
        select: { name: true },
      },
    },
    orderBy: [
      { company: { name: "asc" } },
      { contractStartDate: "desc" },
    ],
  });

  if (contractHistories.length === 0) return [];

  // 全契約の取引を一括取得（N+1回避）
  const contractIds = contractHistories.map((c) => c.id);

  // 月範囲のDate変換
  const firstMonth = targetMonths[0];
  const lastMonth = targetMonths[targetMonths.length - 1];
  const periodStart = new Date(`${firstMonth}-01`);
  const lastMonthDate = new Date(`${lastMonth}-01`);
  const periodEnd = new Date(lastMonthDate.getFullYear(), lastMonthDate.getMonth() + 1, 0);

  const transactions = await prisma.transaction.findMany({
    where: {
      stpContractHistoryId: { in: contractIds },
      deletedAt: null,
      periodFrom: { gte: periodStart },
      periodTo: { lte: periodEnd },
    },
    include: {
      counterparty: { select: { name: true } },
      invoiceGroup: { select: { status: true, invoiceNumber: true } },
      paymentGroup: { select: { status: true, referenceCode: true } },
    },
    orderBy: { periodFrom: "asc" },
  });

  // contractHistoryId → month → transactions のマップ
  const txMap = new Map<number, Map<string, ContractTransaction[]>>();

  for (const tx of transactions) {
    if (!tx.stpContractHistoryId) continue;

    const month = toLocalDateString(tx.periodFrom).substring(0, 7); // "YYYY-MM"
    if (!txMap.has(tx.stpContractHistoryId)) {
      txMap.set(tx.stpContractHistoryId, new Map());
    }
    const monthMap = txMap.get(tx.stpContractHistoryId)!;
    if (!monthMap.has(month)) {
      monthMap.set(month, []);
    }

    monthMap.get(month)!.push({
      id: tx.id,
      type: tx.type,
      stpRevenueType: tx.stpRevenueType,
      stpExpenseType: tx.stpExpenseType,
      amount: tx.amount,
      taxAmount: tx.taxAmount,
      status: tx.status,
      periodFrom: toLocalDateString(tx.periodFrom),
      periodTo: toLocalDateString(tx.periodTo),
      counterpartyName: tx.counterparty.name,
      note: tx.note,
      invoiceGroupId: tx.invoiceGroupId,
      invoiceGroupStatus: tx.invoiceGroup?.status || null,
      invoiceNumber: tx.invoiceGroup?.invoiceNumber || null,
      paymentGroupId: tx.paymentGroupId,
      paymentGroupStatus: tx.paymentGroup?.status || null,
      paymentGroupRef: tx.paymentGroup?.referenceCode || null,
    });
  }

  // 結果を組み立て
  const results: ContractTransactionStatus[] = [];

  for (const ch of contractHistories) {
    const monthMap = txMap.get(ch.id) || new Map();

    const monthlyStatuses: MonthlyTransactionStatus[] = targetMonths.map((month) => {
      const txs = monthMap.get(month) || [];
      return {
        month,
        transactions: txs,
        aggregateStatus: deriveAggregateStatus(txs),
      };
    });

    const result: ContractTransactionStatus = {
      contractHistoryId: ch.id,
      companyId: ch.companyId,
      companyName: ch.company.name,
      industryType: ch.industryType,
      contractPlan: ch.contractPlan,
      jobMedia: ch.jobMedia,
      contractStartDate: toLocalDateString(ch.contractStartDate),
      contractEndDate: ch.contractEndDate ? toLocalDateString(ch.contractEndDate) : null,
      status: ch.status,
      monthlyFee: ch.monthlyFee,
      performanceFee: ch.performanceFee,
      initialFee: ch.initialFee,
      monthlyStatuses,
    };

    // ステータスフィルター
    if (params?.statusFilter) {
      const hasMatchingMonth = monthlyStatuses.some(
        (ms) => ms.aggregateStatus === params.statusFilter
      );
      if (!hasMatchingMonth) continue;
    }

    results.push(result);
  }

  return results;
}

// ============================================
// 契約履歴の取引ステータスサマリー（モーダル用）
// ============================================

export async function getContractHistoryTransactionSummary(contractHistoryId: number): Promise<{
  transactions: ContractTransaction[];
  monthlyStatuses: MonthlyTransactionStatus[];
}> {
  const transactions = await prisma.transaction.findMany({
    where: {
      stpContractHistoryId: contractHistoryId,
      deletedAt: null,
    },
    include: {
      counterparty: { select: { name: true } },
      invoiceGroup: { select: { status: true, invoiceNumber: true } },
      paymentGroup: { select: { status: true, referenceCode: true } },
    },
    orderBy: { periodFrom: "desc" },
  });

  const monthMap = new Map<string, ContractTransaction[]>();

  const mapped: ContractTransaction[] = transactions.map((tx) => {
    const month = toLocalDateString(tx.periodFrom).substring(0, 7);
    const item: ContractTransaction = {
      id: tx.id,
      type: tx.type,
      stpRevenueType: tx.stpRevenueType,
      stpExpenseType: tx.stpExpenseType,
      amount: tx.amount,
      taxAmount: tx.taxAmount,
      status: tx.status,
      periodFrom: toLocalDateString(tx.periodFrom),
      periodTo: toLocalDateString(tx.periodTo),
      counterpartyName: tx.counterparty.name,
      note: tx.note,
      invoiceGroupId: tx.invoiceGroupId,
      invoiceGroupStatus: tx.invoiceGroup?.status || null,
      invoiceNumber: tx.invoiceGroup?.invoiceNumber || null,
      paymentGroupId: tx.paymentGroupId,
      paymentGroupStatus: tx.paymentGroup?.status || null,
      paymentGroupRef: tx.paymentGroup?.referenceCode || null,
    };

    if (!monthMap.has(month)) monthMap.set(month, []);
    monthMap.get(month)!.push(item);

    return item;
  });

  // 月別集計（新しい月順）
  const months = Array.from(monthMap.keys()).sort((a, b) => b.localeCompare(a));
  const monthlyStatuses: MonthlyTransactionStatus[] = months.map((month) => {
    const txs = monthMap.get(month)!;
    return {
      month,
      transactions: txs,
      aggregateStatus: deriveAggregateStatus(txs),
    };
  });

  return { transactions: mapped, monthlyStatuses };
}

// ============================================
// 企業ごとの契約ステータスサマリー（モーダル表示用）
// ============================================

export async function getCompanyContractTransactionBadges(companyId: number): Promise<
  {
    contractHistoryId: number;
    currentMonthStatus: AggregateStatus;
    recentMonthStatuses: { month: string; status: AggregateStatus }[];
  }[]
> {
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const recentMonths = generateMonthRange(now, 3);

  const contractHistories = await prisma.stpContractHistory.findMany({
    where: {
      companyId,
      deletedAt: null,
    },
    select: { id: true },
  });

  if (contractHistories.length === 0) return [];

  const contractIds = contractHistories.map((c) => c.id);

  const firstMonth = recentMonths[0];
  const lastMonth = recentMonths[recentMonths.length - 1];
  const periodStart = new Date(`${firstMonth}-01`);
  const lastMonthDate = new Date(`${lastMonth}-01`);
  const periodEnd = new Date(lastMonthDate.getFullYear(), lastMonthDate.getMonth() + 1, 0);

  const transactions = await prisma.transaction.findMany({
    where: {
      stpContractHistoryId: { in: contractIds },
      deletedAt: null,
      periodFrom: { gte: periodStart },
      periodTo: { lte: periodEnd },
    },
    include: {
      counterparty: { select: { name: true } },
      invoiceGroup: { select: { status: true, invoiceNumber: true } },
      paymentGroup: { select: { status: true, referenceCode: true } },
    },
  });

  // contractHistoryId → month → transactions
  const txMap = new Map<number, Map<string, ContractTransaction[]>>();
  for (const tx of transactions) {
    if (!tx.stpContractHistoryId) continue;
    const month = toLocalDateString(tx.periodFrom).substring(0, 7);
    if (!txMap.has(tx.stpContractHistoryId)) txMap.set(tx.stpContractHistoryId, new Map());
    const mMap = txMap.get(tx.stpContractHistoryId)!;
    if (!mMap.has(month)) mMap.set(month, []);
    mMap.get(month)!.push({
      id: tx.id,
      type: tx.type,
      stpRevenueType: tx.stpRevenueType,
      stpExpenseType: tx.stpExpenseType,
      amount: tx.amount,
      taxAmount: tx.taxAmount,
      status: tx.status,
      periodFrom: toLocalDateString(tx.periodFrom),
      periodTo: toLocalDateString(tx.periodTo),
      counterpartyName: tx.counterparty.name,
      note: tx.note,
      invoiceGroupId: tx.invoiceGroupId,
      invoiceGroupStatus: tx.invoiceGroup?.status || null,
      invoiceNumber: tx.invoiceGroup?.invoiceNumber || null,
      paymentGroupId: tx.paymentGroupId,
      paymentGroupStatus: tx.paymentGroup?.status || null,
      paymentGroupRef: tx.paymentGroup?.referenceCode || null,
    });
  }

  return contractHistories.map((ch) => {
    const mMap = txMap.get(ch.id) || new Map();
    const currentMonthTxs = mMap.get(currentMonth) || [];

    return {
      contractHistoryId: ch.id,
      currentMonthStatus: deriveAggregateStatus(currentMonthTxs),
      recentMonthStatuses: recentMonths.map((month) => ({
        month,
        status: deriveAggregateStatus(mMap.get(month) || []),
      })),
    };
  });
}

// ============================================
// ヘルパー
// ============================================

function generateMonthRange(baseDate: Date, count: number): string[] {
  const months: string[] = [];
  const year = baseDate.getFullYear();
  const month = baseDate.getMonth();

  // 2ヶ月前から開始
  for (let i = -2; i < count - 2; i++) {
    const d = new Date(year, month + i, 1);
    months.push(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
    );
  }
  return months;
}
