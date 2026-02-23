"use client";

import { useState, useMemo } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { TransactionListItem } from "./actions";

type Props = {
  data: TransactionListItem[];
  counterpartyOptions: { value: string; label: string }[];
};

const STATUS_LABELS: Record<string, string> = {
  unconfirmed: "未確認",
  confirmed: "確認済み",
  awaiting_accounting: "経理処理待ち",
  returned: "差し戻し",
  resubmitted: "再提出",
  journalized: "仕訳済み",
  partially_paid: "一部入金",
  paid: "完了",
  hidden: "非表示",
};

const STATUS_STYLES: Record<string, string> = {
  unconfirmed: "bg-gray-100 text-gray-700",
  confirmed: "bg-blue-100 text-blue-700",
  awaiting_accounting: "bg-yellow-100 text-yellow-700",
  returned: "bg-red-100 text-red-700",
  resubmitted: "bg-orange-100 text-orange-700",
  journalized: "bg-indigo-100 text-indigo-700",
  partially_paid: "bg-amber-100 text-amber-700",
  paid: "bg-green-100 text-green-700",
  hidden: "bg-gray-100 text-gray-500",
};

const TYPE_LABELS: Record<string, string> = {
  revenue: "売上",
  expense: "経費",
};

const TYPE_STYLES: Record<string, string> = {
  revenue: "bg-emerald-100 text-emerald-700",
  expense: "bg-rose-100 text-rose-700",
};

type StatusTab = "all" | "unconfirmed" | "confirmed" | "awaiting_accounting" | "returned" | "journalized" | "paid";

const tabs: { key: StatusTab; label: string; filter: (row: TransactionListItem) => boolean }[] = [
  { key: "all", label: "すべて", filter: () => true },
  { key: "unconfirmed", label: "未確認", filter: (r) => r.status === "unconfirmed" },
  { key: "confirmed", label: "確認済み", filter: (r) => r.status === "confirmed" },
  { key: "awaiting_accounting", label: "経理処理待ち", filter: (r) => r.status === "awaiting_accounting" },
  { key: "returned", label: "差し戻し", filter: (r) => r.status === "returned" || r.status === "resubmitted" },
  { key: "journalized", label: "仕訳済み", filter: (r) => r.status === "journalized" },
  { key: "paid", label: "完了", filter: (r) => r.status === "paid" || r.status === "partially_paid" },
];

type SortConfig = {
  field: keyof TransactionListItem;
  direction: "asc" | "desc";
};

export function TransactionsTable({ data, counterpartyOptions }: Props) {
  const [activeTab, setActiveTab] = useState<StatusTab>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [counterpartyFilter, setCounterpartyFilter] = useState<string>("all");
  const [periodFromFilter, setPeriodFromFilter] = useState<string>("");
  const [periodToFilter, setPeriodToFilter] = useState<string>("");
  const [sortConfig, setSortConfig] = useState<SortConfig>({
    field: "periodFrom",
    direction: "desc",
  });

  // フィルタリング
  const filteredData = useMemo(() => {
    const tab = tabs.find((t) => t.key === activeTab)!;
    return data.filter((row) => {
      if (!tab.filter(row)) return false;
      if (typeFilter !== "all" && row.type !== typeFilter) return false;
      if (counterpartyFilter !== "all" && String(row.counterpartyId) !== counterpartyFilter) return false;
      if (periodFromFilter && row.periodFrom < periodFromFilter) return false;
      if (periodToFilter && row.periodTo > periodToFilter) return false;
      return true;
    });
  }, [data, activeTab, typeFilter, counterpartyFilter, periodFromFilter, periodToFilter]);

  // ソート
  const sortedData = useMemo(() => {
    const sorted = [...filteredData];
    sorted.sort((a, b) => {
      const aVal = a[sortConfig.field];
      const bVal = b[sortConfig.field];
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;
      if (typeof aVal === "number" && typeof bVal === "number") {
        return sortConfig.direction === "asc" ? aVal - bVal : bVal - aVal;
      }
      const aStr = String(aVal);
      const bStr = String(bVal);
      const cmp = aStr < bStr ? -1 : aStr > bStr ? 1 : 0;
      return sortConfig.direction === "asc" ? cmp : -cmp;
    });
    return sorted;
  }, [filteredData, sortConfig]);

  // タブ別件数
  const tabCounts = useMemo(() => {
    const baseFiltered = data.filter((row) => {
      if (typeFilter !== "all" && row.type !== typeFilter) return false;
      if (counterpartyFilter !== "all" && String(row.counterpartyId) !== counterpartyFilter) return false;
      if (periodFromFilter && row.periodFrom < periodFromFilter) return false;
      if (periodToFilter && row.periodTo > periodToFilter) return false;
      return true;
    });
    const counts: Record<StatusTab, number> = {
      all: baseFiltered.length,
      unconfirmed: 0,
      confirmed: 0,
      awaiting_accounting: 0,
      returned: 0,
      journalized: 0,
      paid: 0,
    };
    for (const row of baseFiltered) {
      for (const tab of tabs) {
        if (tab.key !== "all" && tab.filter(row)) {
          counts[tab.key]++;
        }
      }
    }
    return counts;
  }, [data, typeFilter, counterpartyFilter, periodFromFilter, periodToFilter]);

  const handleSort = (field: keyof TransactionListItem) => {
    setSortConfig((prev) => ({
      field,
      direction: prev.field === field && prev.direction === "asc" ? "desc" : "asc",
    }));
  };

  const sortIndicator = (field: keyof TransactionListItem) => {
    if (sortConfig.field !== field) return null;
    return sortConfig.direction === "asc" ? " ↑" : " ↓";
  };

  // サマリー計算
  const summary = useMemo(() => {
    const revenue = filteredData
      .filter((r) => r.type === "revenue")
      .reduce((sum, r) => sum + r.amount + r.taxAmount, 0);
    const expense = filteredData
      .filter((r) => r.type === "expense")
      .reduce((sum, r) => sum + r.amount + r.taxAmount, 0);
    return { revenue, expense, count: filteredData.length };
  }, [filteredData]);

  return (
    <div className="space-y-4">
      {/* ステータスタブ */}
      <div className="flex gap-1 border-b">
        {tabs.map((tab) => {
          const isReturned = tab.key === "returned";
          const hasItems = tabCounts[tab.key] > 0;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.key
                  ? isReturned
                    ? "border-red-500 text-red-600"
                    : "border-primary text-primary"
                  : isReturned && hasItems
                    ? "border-transparent text-red-600 hover:border-red-300"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30"
              }`}
            >
              {tab.label}
              <span className={`ml-1.5 text-xs font-normal ${
                isReturned && hasItems ? "text-red-500" : "text-muted-foreground"
              }`}>
                {tabCounts[tab.key]}
              </span>
            </button>
          );
        })}
      </div>

      {/* フィルタ */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <label className="text-sm text-muted-foreground whitespace-nowrap">種別:</label>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="h-8 rounded-md border border-input bg-background px-3 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          >
            <option value="all">すべて</option>
            <option value="revenue">売上</option>
            <option value="expense">経費</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-sm text-muted-foreground whitespace-nowrap">取引先:</label>
          <select
            value={counterpartyFilter}
            onChange={(e) => setCounterpartyFilter(e.target.value)}
            className="h-8 rounded-md border border-input bg-background px-3 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          >
            <option value="all">すべて</option>
            {counterpartyOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-sm text-muted-foreground whitespace-nowrap">期間:</label>
          <input
            type="date"
            value={periodFromFilter}
            onChange={(e) => setPeriodFromFilter(e.target.value)}
            className="h-8 rounded-md border border-input bg-background px-3 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          />
          <span className="text-sm text-muted-foreground">〜</span>
          <input
            type="date"
            value={periodToFilter}
            onChange={(e) => setPeriodToFilter(e.target.value)}
            className="h-8 rounded-md border border-input bg-background px-3 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          />
        </div>

        {(typeFilter !== "all" || counterpartyFilter !== "all" || periodFromFilter || periodToFilter) && (
          <button
            onClick={() => {
              setTypeFilter("all");
              setCounterpartyFilter("all");
              setPeriodFromFilter("");
              setPeriodToFilter("");
            }}
            className="text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded border"
          >
            フィルタをリセット
          </button>
        )}
      </div>

      {/* サマリー */}
      <div className="flex items-center gap-6 text-sm">
        <span className="text-muted-foreground">
          {summary.count}件
        </span>
        <span>
          売上合計: <span className="font-medium text-emerald-600">¥{summary.revenue.toLocaleString()}</span>
        </span>
        <span>
          経費合計: <span className="font-medium text-rose-600">¥{summary.expense.toLocaleString()}</span>
        </span>
      </div>

      {/* テーブル */}
      <div className="border rounded-lg overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[60px]">ID</TableHead>
              <TableHead
                className="cursor-pointer hover:text-foreground w-[60px]"
                onClick={() => handleSort("type")}
              >
                種別{sortIndicator("type")}
              </TableHead>
              <TableHead
                className="cursor-pointer hover:text-foreground"
                onClick={() => handleSort("counterpartyName")}
              >
                取引先{sortIndicator("counterpartyName")}
              </TableHead>
              <TableHead
                className="cursor-pointer hover:text-foreground"
                onClick={() => handleSort("expenseCategoryName")}
              >
                費目{sortIndicator("expenseCategoryName")}
              </TableHead>
              <TableHead>プロジェクト/按分</TableHead>
              <TableHead
                className="cursor-pointer hover:text-foreground text-right"
                onClick={() => handleSort("amount")}
              >
                金額{sortIndicator("amount")}
              </TableHead>
              <TableHead
                className="cursor-pointer hover:text-foreground"
                onClick={() => handleSort("periodFrom")}
              >
                発生期間{sortIndicator("periodFrom")}
              </TableHead>
              <TableHead
                className="cursor-pointer hover:text-foreground"
                onClick={() => handleSort("status")}
              >
                ステータス{sortIndicator("status")}
              </TableHead>
              <TableHead>摘要</TableHead>
              <TableHead
                className="cursor-pointer hover:text-foreground"
                onClick={() => handleSort("createdAt")}
              >
                作成日{sortIndicator("createdAt")}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedData.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                  データがありません
                </TableCell>
              </TableRow>
            ) : (
              sortedData.map((row) => {
                const totalAmount = row.taxType === "tax_excluded"
                  ? row.amount + row.taxAmount
                  : row.amount;

                return (
                  <TableRow key={row.id} className="group/row">
                    <TableCell className="text-muted-foreground text-xs">
                      {row.id}
                    </TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                          TYPE_STYLES[row.type] || "bg-gray-100 text-gray-700"
                        }`}
                      >
                        {TYPE_LABELS[row.type] || row.type}
                      </span>
                    </TableCell>
                    <TableCell className="font-medium">
                      {row.counterpartyName}
                    </TableCell>
                    <TableCell>
                      {row.expenseCategoryName}
                    </TableCell>
                    <TableCell className="text-sm">
                      {row.allocationTemplateName ? (
                        <span className="text-xs text-muted-foreground">
                          按分: {row.allocationTemplateName}
                        </span>
                      ) : row.costCenterName ? (
                        <span>{row.costCenterName}</span>
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="font-medium">
                        ¥{totalAmount.toLocaleString()}
                      </div>
                      {row.taxType === "tax_excluded" ? (
                        <div className="text-xs text-muted-foreground">
                          (税抜¥{row.amount.toLocaleString()} + {row.taxRate}%)
                        </div>
                      ) : (
                        <div className="text-xs text-muted-foreground">
                          (内{row.taxRate}% ¥{row.taxAmount.toLocaleString()})
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-sm whitespace-nowrap">
                      {row.periodFrom === row.periodTo ? (
                        row.periodFrom
                      ) : (
                        <>{row.periodFrom} 〜 {row.periodTo}</>
                      )}
                    </TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                          STATUS_STYLES[row.status] || "bg-gray-100 text-gray-700"
                        }`}
                      >
                        {STATUS_LABELS[row.status] || row.status}
                      </span>
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground">
                      {row.note || "-"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                      {row.createdAt}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
