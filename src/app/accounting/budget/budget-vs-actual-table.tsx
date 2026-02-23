"use client";

import { Badge } from "@/components/ui/badge";
import {
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Minus,
} from "lucide-react";
import type { BudgetVsActualRow } from "./actions";

type Props = {
  rows: BudgetVsActualRow[];
  fiscalYear: number;
  month?: number;
};

function formatCurrency(amount: number): string {
  const prefix = amount < 0 ? "-¥" : "¥";
  return `${prefix}${Math.abs(amount).toLocaleString()}`;
}

function getVarianceColor(difference: number, budgetAmount: number): string {
  if (budgetAmount === 0) return "";
  const ratio = Math.abs(difference) / budgetAmount;
  if (difference < 0) {
    // 超過
    if (ratio > 0.2) return "text-red-600 font-semibold";
    if (ratio > 0.1) return "text-orange-600";
    return "text-yellow-600";
  }
  return "text-green-600";
}

function getAlertLevel(
  difference: number,
  budgetAmount: number
): "danger" | "warning" | null {
  if (budgetAmount === 0) return null;
  const ratio = Math.abs(difference) / budgetAmount;
  if (difference < 0 && ratio > 0.2) return "danger";
  if (difference < 0 && ratio > 0.1) return "warning";
  return null;
}

export function BudgetVsActualTable({ rows, fiscalYear, month }: Props) {
  const periodLabel =
    month !== undefined
      ? `${fiscalYear}年${month + 1}月`
      : `${fiscalYear}年度`;

  // 合計計算
  const totalBudget = rows.reduce((sum, r) => sum + r.budgetAmount, 0);
  const totalActual = rows.reduce((sum, r) => sum + r.actualAmount, 0);
  const totalDifference = totalBudget - totalActual;
  const totalAchievement =
    totalBudget !== 0
      ? Math.round((totalActual / totalBudget) * 10000) / 100
      : null;

  // アラートがある行を先にカウント
  const alertCount = rows.filter(
    (r) => getAlertLevel(r.difference, r.budgetAmount) !== null
  ).length;

  return (
    <div className="space-y-4">
      {/* サマリー */}
      <div className="flex items-center gap-4 text-sm">
        <span className="text-muted-foreground">{periodLabel}</span>
        {alertCount > 0 && (
          <Badge variant="destructive" className="gap-1">
            <AlertTriangle className="h-3 w-3" />
            {alertCount}件のアラート
          </Badge>
        )}
      </div>

      {rows.length === 0 ? (
        <p className="text-muted-foreground text-center py-8">
          予実データがありません。予算を入力してください。
        </p>
      ) : (
        <div className="overflow-x-auto border rounded-lg">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-3 py-2 text-left font-medium">カテゴリ</th>
                <th className="px-3 py-2 text-left font-medium">勘定科目</th>
                <th className="px-3 py-2 text-left font-medium">
                  コストセンター
                </th>
                <th className="px-3 py-2 text-right font-medium">予算</th>
                <th className="px-3 py-2 text-right font-medium">実績</th>
                <th className="px-3 py-2 text-right font-medium">差異</th>
                <th className="px-3 py-2 text-right font-medium">達成率</th>
                <th className="px-3 py-2 text-center font-medium w-[60px]">
                  状態
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => {
                const alert = getAlertLevel(row.difference, row.budgetAmount);
                return (
                  <tr
                    key={idx}
                    className={`border-b hover:bg-muted/50 group/row ${
                      alert === "danger"
                        ? "bg-red-50"
                        : alert === "warning"
                          ? "bg-yellow-50"
                          : ""
                    }`}
                  >
                    <td className="px-3 py-2 font-medium">
                      {row.categoryLabel}
                    </td>
                    <td className="px-3 py-2">
                      {row.accountCode && row.accountName
                        ? `${row.accountCode} ${row.accountName}`
                        : "-"}
                    </td>
                    <td className="px-3 py-2">
                      {row.costCenterName ?? "全社"}
                    </td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      {formatCurrency(row.budgetAmount)}
                    </td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      {formatCurrency(row.actualAmount)}
                    </td>
                    <td
                      className={`px-3 py-2 text-right whitespace-nowrap ${getVarianceColor(
                        row.difference,
                        row.budgetAmount
                      )}`}
                    >
                      <div className="flex items-center justify-end gap-1">
                        {row.difference > 0 ? (
                          <TrendingDown className="h-3 w-3 text-green-500" />
                        ) : row.difference < 0 ? (
                          <TrendingUp className="h-3 w-3 text-red-500" />
                        ) : (
                          <Minus className="h-3 w-3 text-gray-400" />
                        )}
                        {formatCurrency(row.difference)}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      {row.achievementRate !== null
                        ? `${row.achievementRate}%`
                        : "-"}
                    </td>
                    <td className="px-3 py-2 text-center">
                      {alert === "danger" ? (
                        <AlertTriangle className="h-4 w-4 text-red-500 mx-auto" />
                      ) : alert === "warning" ? (
                        <AlertTriangle className="h-4 w-4 text-yellow-500 mx-auto" />
                      ) : null}
                    </td>
                  </tr>
                );
              })}
              {/* 合計行 */}
              <tr className="border-t-2 bg-muted/30 font-semibold">
                <td className="px-3 py-2" colSpan={3}>
                  合計
                </td>
                <td className="px-3 py-2 text-right whitespace-nowrap">
                  {formatCurrency(totalBudget)}
                </td>
                <td className="px-3 py-2 text-right whitespace-nowrap">
                  {formatCurrency(totalActual)}
                </td>
                <td
                  className={`px-3 py-2 text-right whitespace-nowrap ${getVarianceColor(
                    totalDifference,
                    totalBudget
                  )}`}
                >
                  {formatCurrency(totalDifference)}
                </td>
                <td className="px-3 py-2 text-right whitespace-nowrap">
                  {totalAchievement !== null ? `${totalAchievement}%` : "-"}
                </td>
                <td className="px-3 py-2"></td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
