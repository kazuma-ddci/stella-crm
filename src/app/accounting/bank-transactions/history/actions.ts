"use server";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { ok, err, type ActionResult } from "@/lib/action-result";
import { requireStaffForAccounting } from "@/lib/auth/staff-action";

// ============================================
// 型定義
// ============================================

export type TransactionHistoryRow = {
  id: number;
  transactionDate: Date;
  direction: string;
  amount: number;
  balance: number | null;
  counterpartyName: string;
  description: string | null;
  memo: string | null;
  bankAccountName: string | null;
  source: string;
  sourceService: string | null;
  operatingCompany: { id: number; companyName: string } | null;
  importBatch: { id: number; fileName: string | null; importedAt: Date } | null;
  reconciliationStatus: string;
  createdAt: Date;
};

export type HistoryFilterOptions = {
  operatingCompanies: { id: number; companyName: string }[];
  bankAccountNames: string[];
  sources: string[];
};

export type HistoryFilters = {
  yearMonth?: string;
  operatingCompanyId?: number;
  bankAccountName?: string;
  direction?: string;
  source?: string;
  search?: string;
};

// ============================================
// データ取得
// ============================================

export async function getTransactionHistory(
  filters?: HistoryFilters
): Promise<TransactionHistoryRow[]> {
  await requireStaffForAccounting("view");

  const where: Record<string, unknown> = {};

  // 年月フィルタ (YYYY-MM)
  if (filters?.yearMonth) {
    const [year, month] = filters.yearMonth.split("-").map(Number);
    if (year && month) {
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 1);
      where.transactionDate = {
        gte: startDate,
        lt: endDate,
      };
    }
  }

  // 法人フィルタ
  if (filters?.operatingCompanyId) {
    where.operatingCompanyId = filters.operatingCompanyId;
  }

  // 銀行名フィルタ
  if (filters?.bankAccountName) {
    where.bankAccountName = filters.bankAccountName;
  }

  // 入金/出金フィルタ
  if (filters?.direction && ["incoming", "outgoing"].includes(filters.direction)) {
    where.direction = filters.direction;
  }

  // ソースフィルタ
  if (filters?.source) {
    where.source = filters.source;
  }

  const transactions = await prisma.accountingTransaction.findMany({
    where,
    orderBy: [{ transactionDate: "desc" }, { id: "desc" }],
    take: 1000,
    select: {
      id: true,
      transactionDate: true,
      direction: true,
      amount: true,
      balance: true,
      counterpartyName: true,
      description: true,
      memo: true,
      bankAccountName: true,
      source: true,
      sourceService: true,
      reconciliationStatus: true,
      createdAt: true,
      operatingCompany: {
        select: { id: true, companyName: true },
      },
      importBatch: {
        select: { id: true, fileName: true, importedAt: true },
      },
    },
  });

  // テキスト検索（取得後フィルタ）
  if (filters?.search?.trim()) {
    const q = filters.search.trim().toLowerCase();
    return transactions.filter(
      (tx) =>
        tx.counterpartyName?.toLowerCase().includes(q) ||
        tx.description?.toLowerCase().includes(q) ||
        tx.memo?.toLowerCase().includes(q) ||
        tx.bankAccountName?.toLowerCase().includes(q) ||
        String(tx.amount).includes(q)
    );
  }

  return transactions;
}

export async function getHistoryFilterOptions(): Promise<HistoryFilterOptions> {
  await requireStaffForAccounting("view");

  const [operatingCompanies, bankAccountNamesRaw, sourcesRaw] = await Promise.all([
    prisma.operatingCompany.findMany({
      where: { isActive: true },
      select: { id: true, companyName: true },
      orderBy: { id: "asc" },
    }),
    prisma.accountingTransaction.findMany({
      where: { bankAccountName: { not: null } },
      select: { bankAccountName: true },
      distinct: ["bankAccountName"],
      orderBy: { bankAccountName: "asc" },
    }),
    prisma.accountingTransaction.findMany({
      select: { source: true },
      distinct: ["source"],
      orderBy: { source: "asc" },
    }),
  ]);

  return {
    operatingCompanies,
    bankAccountNames: bankAccountNamesRaw
      .map((r) => r.bankAccountName)
      .filter((name): name is string => name !== null),
    sources: sourcesRaw.map((r) => r.source),
  };
}

// ============================================
// 削除
// ============================================

export async function deleteTransaction(id: number): Promise<ActionResult> {
  // 注: requireStaffWithProjectPermission の redirect を伝播させるため try/catch の外で呼ぶ
  await requireStaffForAccounting("edit");
  try {
    const existing = await prisma.accountingTransaction.findUnique({
      where: { id },
    });
    if (!existing) {
      return err("取引データが見つかりません");
    }

    await prisma.accountingTransaction.delete({
      where: { id },
    });
    return ok();
  } catch (e) {
    console.error("[deleteTransaction] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
}

// ============================================
// CSVエクスポート
// ============================================

export async function exportTransactionsCsv(
  filters?: HistoryFilters
): Promise<string> {
  const transactions = await getTransactionHistory(filters);

  const headers = [
    "日付",
    "入出金",
    "金額",
    "残高",
    "取引先名",
    "摘要",
    "メモ",
    "法人名",
    "銀行名",
    "ソース",
    "消込ステータス",
  ];

  const rows = transactions.map((tx) => [
    tx.transactionDate
      ? new Date(tx.transactionDate).toISOString().split("T")[0]
      : "",
    tx.direction === "incoming" ? "入金" : "出金",
    String(tx.amount),
    tx.balance !== null ? String(tx.balance) : "",
    tx.counterpartyName,
    tx.description ?? "",
    tx.memo ?? "",
    tx.operatingCompany?.companyName ?? "",
    tx.bankAccountName ?? "",
    tx.source,
    tx.reconciliationStatus,
  ]);

  const escapeCsv = (val: string) => {
    if (val.includes(",") || val.includes('"') || val.includes("\n")) {
      return `"${val.replace(/"/g, '""')}"`;
    }
    return val;
  };

  const csvLines = [headers, ...rows].map((row) =>
    row.map(escapeCsv).join(",")
  );

  return "\uFEFF" + csvLines.join("\n");
}
