"use server";

import { prisma } from "@/lib/prisma";

export type DashboardData = {
  pendingCounts: {
    unjournalizedTransactions: number;
    unreconciledBankTransactions: number;
    unconfirmedAllocations: number;
  };
  alerts: {
    missingTransactions: Array<{
      contractId: number;
      contractTitle: string;
      companyName: string;
    }>;
    contractMismatches: Array<{
      transactionId: number;
      contractTitle: string;
      contractEndDate: Date;
      periodFrom: Date;
      companyName: string;
    }>;
    balanceAlerts: Array<{
      paymentMethodId: number;
      name: string;
      methodType: string;
      currentBalance: number;
      threshold: number;
    }>;
    overdueInvoices: Array<{
      invoiceGroupId: number;
      invoiceNumber: string | null;
      paymentDueDate: Date;
      totalAmount: number | null;
      counterpartyName: string;
    }>;
  };
  monthlySummary: {
    revenue: number;
    expense: number;
    incoming: number;
    outgoing: number;
    unpaidInvoices: number;
  };
};

export async function getDashboardData(): Promise<DashboardData> {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

  // --- 未処理件数 ---
  const [
    unjournalizedTransactions,
    unreconciledBankTransactions,
    unconfirmedAllocationsRaw,
  ] = await Promise.all([
    // 未仕訳取引: 経理処理待ち・再提出で仕訳がまだないもの
    prisma.transaction.count({
      where: {
        status: { in: ["awaiting_accounting", "resubmitted"] },
        deletedAt: null,
        journalEntries: { none: {} },
      },
    }),
    // 未消込入出金: Reconciliation が紐づいていない BankTransaction
    prisma.bankTransaction.count({
      where: {
        deletedAt: null,
        reconciliations: { none: {} },
      },
    }),
    // 按分未確定: allocationTemplate 付き取引で AllocationConfirmation が不足しているもの
    prisma.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(DISTINCT t.id) as count
      FROM "Transaction" t
      INNER JOIN "AllocationTemplateLine" atl ON atl."templateId" = t."allocationTemplateId"
      LEFT JOIN "AllocationConfirmation" ac
        ON ac."transactionId" = t.id AND ac."costCenterId" = atl."costCenterId"
      WHERE t."deletedAt" IS NULL
        AND t."allocationTemplateId" IS NOT NULL
        AND atl."costCenterId" IS NOT NULL
        AND ac.id IS NULL
    `,
  ]);

  const unconfirmedAllocations = Number(unconfirmedAllocationsRaw[0]?.count ?? 0);

  // --- アラート ---
  const [
    missingTransactions,
    transactionsWithContracts,
    paymentMethodsWithThreshold,
    overdueInvoicesRaw,
  ] = await Promise.all([
    // 取引未申請: 有効な契約があるのに当月取引がない
    prisma.masterContract.findMany({
      where: {
        isActive: true,
        OR: [{ endDate: null }, { endDate: { gte: startOfMonth } }],
        finTransactions: {
          none: {
            deletedAt: null,
            periodFrom: { lte: endOfMonth },
            periodTo: { gte: startOfMonth },
          },
        },
      },
      select: {
        id: true,
        title: true,
        company: { select: { name: true } },
      },
      take: 10,
    }),
    // 契約矛盾: 契約終了後に取引が登録されている
    prisma.transaction.findMany({
      where: {
        deletedAt: null,
        contractId: { not: null },
        contract: { endDate: { not: null } },
        status: { notIn: ["hidden"] },
      },
      select: {
        id: true,
        periodFrom: true,
        contract: {
          select: {
            id: true,
            title: true,
            endDate: true,
            company: { select: { name: true } },
          },
        },
      },
      take: 100,
    }),
    // 残高アラート用: 閾値設定済みの決済手段
    prisma.paymentMethod.findMany({
      where: {
        isActive: true,
        deletedAt: null,
        balanceAlertThreshold: { not: null },
        initialBalance: { not: null },
      },
      select: {
        id: true,
        name: true,
        methodType: true,
        initialBalance: true,
        balanceAlertThreshold: true,
      },
    }),
    // 入金期限超過: paymentDueDate を過ぎた未入金の請求グループ
    prisma.invoiceGroup.findMany({
      where: {
        deletedAt: null,
        paymentDueDate: { lt: now },
        status: { in: ["sent", "awaiting_accounting", "partially_paid"] },
      },
      select: {
        id: true,
        invoiceNumber: true,
        paymentDueDate: true,
        totalAmount: true,
        counterparty: { select: { name: true } },
      },
      orderBy: { paymentDueDate: "asc" },
      take: 10,
    }),
  ]);

  // 契約矛盾: JS 側で endDate < periodFrom をフィルタ
  const contractMismatches = transactionsWithContracts
    .filter(
      (t) => t.contract?.endDate && t.contract.endDate < t.periodFrom
    )
    .slice(0, 10)
    .map((t) => ({
      transactionId: t.id,
      contractTitle: t.contract!.title,
      contractEndDate: t.contract!.endDate!,
      periodFrom: t.periodFrom,
      companyName: t.contract!.company.name,
    }));

  // 残高アラート: 各決済手段の残高を計算
  const balanceAlerts: DashboardData["alerts"]["balanceAlerts"] = [];
  for (const pm of paymentMethodsWithThreshold) {
    const [incomingAgg, outgoingAgg] = await Promise.all([
      prisma.bankTransaction.aggregate({
        where: { paymentMethodId: pm.id, direction: "incoming", deletedAt: null },
        _sum: { amount: true },
      }),
      prisma.bankTransaction.aggregate({
        where: { paymentMethodId: pm.id, direction: "outgoing", deletedAt: null },
        _sum: { amount: true },
      }),
    ]);
    const currentBalance =
      (pm.initialBalance ?? 0) +
      (incomingAgg._sum.amount ?? 0) -
      (outgoingAgg._sum.amount ?? 0);
    if (currentBalance < (pm.balanceAlertThreshold ?? 0)) {
      balanceAlerts.push({
        paymentMethodId: pm.id,
        name: pm.name,
        methodType: pm.methodType,
        currentBalance,
        threshold: pm.balanceAlertThreshold!,
      });
    }
  }

  const overdueInvoices = overdueInvoicesRaw.map((ig) => ({
    invoiceGroupId: ig.id,
    invoiceNumber: ig.invoiceNumber,
    paymentDueDate: ig.paymentDueDate!,
    totalAmount: ig.totalAmount,
    counterpartyName: ig.counterparty.name,
  }));

  // --- 今月サマリー ---
  const [revenueAgg, expenseAgg, incomingAgg, outgoingAgg, unpaidInvoicesAgg] =
    await Promise.all([
      // 売上合計（税込 = amount + taxAmount）
      prisma.transaction.aggregate({
        where: {
          type: "revenue",
          deletedAt: null,
          status: { notIn: ["hidden"] },
          periodFrom: { lte: endOfMonth },
          periodTo: { gte: startOfMonth },
        },
        _sum: { amount: true, taxAmount: true },
      }),
      // 経費合計
      prisma.transaction.aggregate({
        where: {
          type: "expense",
          deletedAt: null,
          status: { notIn: ["hidden"] },
          periodFrom: { lte: endOfMonth },
          periodTo: { gte: startOfMonth },
        },
        _sum: { amount: true, taxAmount: true },
      }),
      // 入金合計
      prisma.bankTransaction.aggregate({
        where: {
          direction: "incoming",
          deletedAt: null,
          transactionDate: { gte: startOfMonth, lte: endOfMonth },
        },
        _sum: { amount: true },
      }),
      // 出金合計
      prisma.bankTransaction.aggregate({
        where: {
          direction: "outgoing",
          deletedAt: null,
          transactionDate: { gte: startOfMonth, lte: endOfMonth },
        },
        _sum: { amount: true },
      }),
      // 未入金（送付済み〜一部入金の請求グループの合計）
      prisma.invoiceGroup.aggregate({
        where: {
          deletedAt: null,
          status: { in: ["sent", "awaiting_accounting", "partially_paid"] },
        },
        _sum: { totalAmount: true },
      }),
    ]);

  return {
    pendingCounts: {
      unjournalizedTransactions,
      unreconciledBankTransactions,
      unconfirmedAllocations,
    },
    alerts: {
      missingTransactions: missingTransactions.map((c) => ({
        contractId: c.id,
        contractTitle: c.title,
        companyName: c.company.name,
      })),
      contractMismatches,
      balanceAlerts,
      overdueInvoices,
    },
    monthlySummary: {
      revenue:
        (revenueAgg._sum.amount ?? 0) + (revenueAgg._sum.taxAmount ?? 0),
      expense:
        (expenseAgg._sum.amount ?? 0) + (expenseAgg._sum.taxAmount ?? 0),
      incoming: incomingAgg._sum.amount ?? 0,
      outgoing: outgoingAgg._sum.amount ?? 0,
      unpaidInvoices: unpaidInvoicesAgg._sum.totalAmount ?? 0,
    },
  };
}
