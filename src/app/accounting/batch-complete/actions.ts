"use server";

import { prisma } from "@/lib/prisma";

// ============================================
// 型定義
// ============================================

export type AwaitingGroupItem = {
  id: number;
  groupType: "invoice" | "payment";
  counterpartyName: string;
  operatingCompanyName: string;
  projectName: string | null;
  totalAmount: number | null;
  taxAmount: number | null;
  status: string;
  label: string; // 請求書番号 or 対象月
  transactionCount: number;
  allocationItemCount: number;
  hasUnprocessedAllocations: boolean;
  createdAt: string;
};

// ============================================
// 経理処理待ちグループ一覧取得
// ============================================

export async function getAwaitingAccountingGroups(): Promise<AwaitingGroupItem[]> {
  const results: AwaitingGroupItem[] = [];

  // 請求グループ: awaiting_accounting, partially_paid
  const invoiceGroups = await prisma.invoiceGroup.findMany({
    where: {
      deletedAt: null,
      status: { in: ["awaiting_accounting", "partially_paid"] },
    },
    include: {
      counterparty: { select: { name: true } },
      operatingCompany: { select: { companyName: true } },
      project: { select: { name: true } },
      transactions: {
        where: { deletedAt: null },
        select: {
          id: true,
          allocationTemplateId: true,
          allocationConfirmations: { select: { costCenterId: true } },
        },
      },
      allocationItems: {
        select: {
          id: true,
          transactionId: true,
          costCenterId: true,
        },
      },
    },
    orderBy: [{ createdAt: "desc" }],
  });

  for (const g of invoiceGroups) {
    // 按分取引の全PJ処理状況を確認
    let hasUnprocessed = false;
    for (const tx of g.transactions) {
      if (!tx.allocationTemplateId) continue;
      // allocationTemplateのlines数とallocationItemsのグループ内の数を比較
      // 簡易チェック: このグループ内の取引の按分テンプレートに対して、全CCのAllocationGroupItemが存在するか
      const template = await prisma.allocationTemplate.findUnique({
        where: { id: tx.allocationTemplateId },
        include: { lines: { where: { costCenterId: { not: null } } } },
      });
      if (template) {
        const existingItems = await prisma.allocationGroupItem.findMany({
          where: { transactionId: tx.id, groupType: "invoice" },
          select: { costCenterId: true },
        });
        const processedCcIds = new Set(existingItems.map((i) => i.costCenterId));
        for (const line of template.lines) {
          if (line.costCenterId && !processedCcIds.has(line.costCenterId)) {
            hasUnprocessed = true;
            break;
          }
        }
      }
      if (hasUnprocessed) break;
    }

    results.push({
      id: g.id,
      groupType: "invoice",
      counterpartyName: g.counterparty.name,
      operatingCompanyName: g.operatingCompany.companyName,
      projectName: g.project?.name ?? null,
      totalAmount: g.totalAmount,
      taxAmount: g.taxAmount,
      status: g.status,
      label: g.invoiceNumber ?? `請求#${g.id}`,
      transactionCount: g.transactions.length,
      allocationItemCount: g.allocationItems.length,
      hasUnprocessedAllocations: hasUnprocessed,
      createdAt: g.createdAt.toISOString().split("T")[0],
    });
  }

  // 支払グループ: awaiting_accounting
  const paymentGroups = await prisma.paymentGroup.findMany({
    where: {
      deletedAt: null,
      status: { in: ["awaiting_accounting"] },
    },
    include: {
      counterparty: { select: { name: true } },
      operatingCompany: { select: { companyName: true } },
      project: { select: { name: true } },
      transactions: {
        where: { deletedAt: null },
        select: {
          id: true,
          allocationTemplateId: true,
        },
      },
      allocationItems: {
        select: {
          id: true,
          transactionId: true,
          costCenterId: true,
        },
      },
    },
    orderBy: [{ createdAt: "desc" }],
  });

  for (const g of paymentGroups) {
    let hasUnprocessed = false;
    for (const tx of g.transactions) {
      if (!tx.allocationTemplateId) continue;
      const template = await prisma.allocationTemplate.findUnique({
        where: { id: tx.allocationTemplateId },
        include: { lines: { where: { costCenterId: { not: null } } } },
      });
      if (template) {
        const existingItems = await prisma.allocationGroupItem.findMany({
          where: { transactionId: tx.id, groupType: "payment" },
          select: { costCenterId: true },
        });
        const processedCcIds = new Set(existingItems.map((i) => i.costCenterId));
        for (const line of template.lines) {
          if (line.costCenterId && !processedCcIds.has(line.costCenterId)) {
            hasUnprocessed = true;
            break;
          }
        }
      }
      if (hasUnprocessed) break;
    }

    const month = g.targetMonth;
    results.push({
      id: g.id,
      groupType: "payment",
      counterpartyName: g.counterparty.name,
      operatingCompanyName: g.operatingCompany.companyName,
      projectName: g.project?.name ?? null,
      totalAmount: g.totalAmount,
      taxAmount: g.taxAmount,
      status: g.status,
      label: `支払 ${month.getUTCFullYear()}/${String(month.getUTCMonth() + 1).padStart(2, "0")}`,
      transactionCount: g.transactions.length,
      allocationItemCount: g.allocationItems.length,
      hasUnprocessedAllocations: hasUnprocessed,
      createdAt: g.createdAt.toISOString().split("T")[0],
    });
  }

  return results;
}
