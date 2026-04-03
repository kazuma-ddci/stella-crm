"use server";

import { prisma } from "@/lib/prisma";
import { toLocalDateString } from "@/lib/utils";

// ============================================
// 型定義
// ============================================

export type TransactionSummary = {
  revenueTotal: number; // 売上合計（税込）
  expenseTotal: number; // 経費合計（税込）
  revenueCount: number;
  expenseCount: number;
  byStatus: {
    status: string;
    count: number;
    total: number;
  }[];
};

export type InvoiceGroupSummary = {
  total: number;
  byStatus: {
    status: string;
    label: string;
    count: number;
  }[];
};

export type PaymentGroupSummary = {
  total: number;
  byStatus: {
    status: string;
    label: string;
    count: number;
  }[];
};

export type RecentActivity = {
  id: number;
  entityType: "transaction" | "invoice_group" | "payment_group";
  entityId: number;
  description: string;
  status: string;
  amount: number | null;
  createdAt: string;
};

export type MonthlyTrend = {
  month: string; // YYYY/MM
  revenue: number;
  expense: number;
  profit: number;
};

export type ProjectDashboardData = {
  transactionSummary: TransactionSummary;
  invoiceGroupSummary: InvoiceGroupSummary;
  paymentGroupSummary: PaymentGroupSummary;
  recentActivities: RecentActivity[];
  monthlyTrends: MonthlyTrend[];
};

// ============================================
// ラベルマッピング
// ============================================

const TRANSACTION_STATUS_LABELS: Record<string, string> = {
  unconfirmed: "未確認",
  confirmed: "確認済み",
  awaiting_accounting: "経理処理待ち",
  returned: "差し戻し",
  resubmitted: "再提出",
  journalized: "仕訳済み",
  partially_paid: "一部入金/支払",
  paid: "完了",
  hidden: "非表示",
};

const INVOICE_GROUP_STATUS_LABELS: Record<string, string> = {
  draft: "下書き",
  pdf_created: "PDF作成済み",
  sent: "送付済み",
  awaiting_accounting: "経理処理待ち",
  partially_paid: "一部入金",
  paid: "入金完了",
  returned: "差し戻し",
  corrected: "訂正済み",
};

const PAYMENT_GROUP_STATUS_LABELS: Record<string, string> = {
  before_request: "依頼前",
  requested: "依頼済み",
  invoice_received: "請求書受領",
  rejected: "差し戻し",
  re_requested: "再依頼",
  confirmed: "確認済み",
  paid: "支払済み",
};

// ============================================
// メイン取得関数
// ============================================

export async function getProjectDashboard(): Promise<ProjectDashboardData> {
  const now = new Date();

  // 直近6ヶ月分の月初日を計算
  const monthStarts: Date[] = [];
  for (let i = 5; i >= 0; i--) {
    monthStarts.push(new Date(now.getFullYear(), now.getMonth() - i, 1));
  }
  const [transactions, invoiceGroups, paymentGroups, recentTransactions, recentInvoiceGroups, recentPaymentGroups] =
    await Promise.all([
      // 全取引（削除除く）
      prisma.transaction.findMany({
        where: { deletedAt: null },
        select: {
          id: true,
          type: true,
          amount: true,
          taxAmount: true,
          taxType: true,
          status: true,
          periodFrom: true,
        },
      }),
      // 全請求グループ（削除除く）
      prisma.invoiceGroup.findMany({
        where: { deletedAt: null },
        select: {
          id: true,
          status: true,
        },
      }),
      // 全支払グループ（削除除く）
      prisma.paymentGroup.findMany({
        where: { deletedAt: null },
        select: {
          id: true,
          status: true,
        },
      }),
      // 直近アクティビティ: 取引（最新10件）
      prisma.transaction.findMany({
        where: { deletedAt: null },
        select: {
          id: true,
          type: true,
          amount: true,
          taxAmount: true,
          taxType: true,
          status: true,
          counterparty: { select: { name: true } },
          expenseCategory: { select: { name: true } },
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
      // 直近アクティビティ: 請求グループ（最新5件）
      prisma.invoiceGroup.findMany({
        where: { deletedAt: null },
        select: {
          id: true,
          status: true,
          totalAmount: true,
          counterparty: { select: { name: true } },
          invoiceNumber: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
      // 直近アクティビティ: 支払グループ（最新5件）
      prisma.paymentGroup.findMany({
        where: { deletedAt: null },
        select: {
          id: true,
          status: true,
          totalAmount: true,
          counterparty: { select: { name: true } },
          targetMonth: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
    ]);

  // --- 取引サマリー ---
  const calcTotalWithTax = (amount: number, taxAmount: number, taxType: string): number => {
    return taxType === "tax_included" ? amount : amount + taxAmount;
  };

  const revenueTransactions = transactions.filter((t) => t.type === "revenue");
  const expenseTransactions = transactions.filter((t) => t.type === "expense");

  const revenueTotal = revenueTransactions.reduce(
    (sum, t) => sum + calcTotalWithTax(t.amount, t.taxAmount, t.taxType),
    0
  );
  const expenseTotal = expenseTransactions.reduce(
    (sum, t) => sum + calcTotalWithTax(t.amount, t.taxAmount, t.taxType),
    0
  );

  // ステータス別集計
  const statusMap = new Map<string, { count: number; total: number }>();
  for (const t of transactions) {
    const entry = statusMap.get(t.status) ?? { count: 0, total: 0 };
    entry.count++;
    entry.total += calcTotalWithTax(t.amount, t.taxAmount, t.taxType);
    statusMap.set(t.status, entry);
  }

  const byStatus = Array.from(statusMap.entries()).map(([status, data]) => ({
    status,
    count: data.count,
    total: data.total,
  }));

  const transactionSummary: TransactionSummary = {
    revenueTotal,
    expenseTotal,
    revenueCount: revenueTransactions.length,
    expenseCount: expenseTransactions.length,
    byStatus,
  };

  // --- 請求グループサマリー ---
  const igStatusMap = new Map<string, number>();
  for (const ig of invoiceGroups) {
    igStatusMap.set(ig.status, (igStatusMap.get(ig.status) ?? 0) + 1);
  }

  const invoiceGroupSummary: InvoiceGroupSummary = {
    total: invoiceGroups.length,
    byStatus: Array.from(igStatusMap.entries()).map(([status, count]) => ({
      status,
      label: INVOICE_GROUP_STATUS_LABELS[status] ?? status,
      count,
    })),
  };

  // --- 支払グループサマリー ---
  const pgStatusMap = new Map<string, number>();
  for (const pg of paymentGroups) {
    pgStatusMap.set(pg.status, (pgStatusMap.get(pg.status) ?? 0) + 1);
  }

  const paymentGroupSummary: PaymentGroupSummary = {
    total: paymentGroups.length,
    byStatus: Array.from(pgStatusMap.entries()).map(([status, count]) => ({
      status,
      label: PAYMENT_GROUP_STATUS_LABELS[status] ?? status,
      count,
    })),
  };

  // --- 直近アクティビティ ---
  const activities: RecentActivity[] = [];

  for (const t of recentTransactions) {
    const totalWithTax = calcTotalWithTax(t.amount, t.taxAmount, t.taxType);
    const typeLabel = t.type === "revenue" ? "売上" : "経費";
    activities.push({
      id: activities.length,
      entityType: "transaction",
      entityId: t.id,
      description: `${typeLabel}: ${t.counterparty.name} - ${t.expenseCategory?.name ?? "（未設定）"}`,
      status: TRANSACTION_STATUS_LABELS[t.status] ?? t.status,
      amount: totalWithTax,
      createdAt: t.createdAt.toISOString(),
    });
  }

  for (const ig of recentInvoiceGroups) {
    activities.push({
      id: activities.length,
      entityType: "invoice_group",
      entityId: ig.id,
      description: `請求: ${ig.counterparty.name}${ig.invoiceNumber ? ` (${ig.invoiceNumber})` : ""}`,
      status: INVOICE_GROUP_STATUS_LABELS[ig.status] ?? ig.status,
      amount: ig.totalAmount,
      createdAt: ig.createdAt.toISOString(),
    });
  }

  for (const pg of recentPaymentGroups) {
    const monthLabel = pg.targetMonth ? toLocalDateString(pg.targetMonth).slice(0, 7) : "未設定";
    activities.push({
      id: activities.length,
      entityType: "payment_group",
      entityId: pg.id,
      description: `支払: ${pg.counterparty.name} (${monthLabel})`,
      status: PAYMENT_GROUP_STATUS_LABELS[pg.status] ?? pg.status,
      amount: pg.totalAmount,
      createdAt: pg.createdAt.toISOString(),
    });
  }

  // 日付降順でソート
  activities.sort((a, b) => (a.createdAt > b.createdAt ? -1 : 1));
  const recentActivities = activities.slice(0, 15);

  // --- 月別推移 ---
  const monthlyTrends: MonthlyTrend[] = monthStarts.map((monthStart) => {
    const nextMonth = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 1);
    const label = `${monthStart.getFullYear()}/${String(monthStart.getMonth() + 1).padStart(2, "0")}`;

    const monthTransactions = transactions.filter((t) => {
      return t.periodFrom >= monthStart && t.periodFrom < nextMonth;
    });

    const revenue = monthTransactions
      .filter((t) => t.type === "revenue")
      .reduce((sum, t) => sum + calcTotalWithTax(t.amount, t.taxAmount, t.taxType), 0);

    const expense = monthTransactions
      .filter((t) => t.type === "expense")
      .reduce((sum, t) => sum + calcTotalWithTax(t.amount, t.taxAmount, t.taxType), 0);

    return {
      month: label,
      revenue,
      expense,
      profit: revenue - expense,
    };
  });

  return {
    transactionSummary,
    invoiceGroupSummary,
    paymentGroupSummary,
    recentActivities,
    monthlyTrends,
  };
}
