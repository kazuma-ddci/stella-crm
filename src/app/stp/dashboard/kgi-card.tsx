"use client";

import { cn } from "@/lib/utils";

type KgiCardProps = {
  title: string;
  value: string;
  unit: string;
  target?: string;
  targetLabel?: string;
  forecastLabel?: string;
  forecastValue?: string;
  progressPercent: number;
  metaLeft: string;
  metaRight: string;
  status: "achieved" | "good" | "caution" | "behind" | "surplus" | "deficit";
  statusLabel: string;
  isNegative?: boolean;
};

const STATUS_CONFIG = {
  achieved: {
    color: "text-green-600",
    bg: "bg-green-50",
    border: "border-green-200",
    bar: "bg-green-500",
    accent: "bg-green-500",
    dot: "bg-green-500",
  },
  good: {
    color: "text-green-600",
    bg: "bg-green-50",
    border: "border-green-200",
    bar: "bg-green-500",
    accent: "bg-green-500",
    dot: "bg-green-500",
  },
  caution: {
    color: "text-yellow-600",
    bg: "bg-yellow-50",
    border: "border-yellow-200",
    bar: "bg-yellow-500",
    accent: "bg-yellow-500",
    dot: "bg-yellow-500",
  },
  behind: {
    color: "text-red-600",
    bg: "bg-red-50",
    border: "border-red-200",
    bar: "bg-red-500",
    accent: "bg-red-500",
    dot: "bg-red-500",
  },
  surplus: {
    color: "text-green-600",
    bg: "bg-green-50",
    border: "border-green-200",
    bar: "bg-green-500",
    accent: "bg-green-500",
    dot: "bg-green-500",
  },
  deficit: {
    color: "text-red-600",
    bg: "bg-red-50",
    border: "border-red-200",
    bar: "bg-red-500",
    accent: "bg-red-500",
    dot: "bg-red-500",
  },
};

export function KgiCard({
  title,
  value,
  unit,
  target,
  targetLabel = "目標",
  forecastLabel,
  forecastValue,
  progressPercent,
  metaLeft,
  metaRight,
  status,
  statusLabel,
  isNegative,
}: KgiCardProps) {
  const cfg = STATUS_CONFIG[status];

  return (
    <div className="relative overflow-hidden rounded-xl border bg-white shadow-sm h-full flex flex-col">
      {/* 上部アクセントライン */}
      <div className={cn("h-0.5", cfg.accent)} />

      <div className="flex flex-col p-4 sm:p-5 h-full">
        {/* ラベル行: カード名 + ステータスバッジ */}
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-medium text-gray-500">{title}</span>
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium",
              cfg.bg,
              cfg.color,
              cfg.border,
              "border"
            )}
          >
            <span className={cn("h-1.5 w-1.5 rounded-full", cfg.dot)} />
            {statusLabel}
          </span>
        </div>

        {/* メイン値 */}
        <div className="mb-2">
          <span
            className={cn(
              "text-2xl sm:text-3xl font-bold tabular-nums",
              isNegative ? "text-red-600" : "text-gray-900"
            )}
          >
            {value}
          </span>
          <span className="ml-1 text-sm text-gray-400">{unit}</span>
        </div>

        {/* 目標行 */}
        {target && (
          <div className="text-xs text-gray-500 mb-1">
            {targetLabel && `${targetLabel} `}
            <span className="font-medium text-gray-700 tabular-nums">
              {target}
            </span>
          </div>
        )}

        {/* 着地予測行 */}
        {forecastLabel && forecastValue && (
          <div className="text-xs text-gray-500">
            {forecastLabel}:{" "}
            <span className="font-medium text-amber-600 tabular-nums">
              {forecastValue}
            </span>
          </div>
        )}

        {/* スペーサー: バー位置を下に揃える */}
        <div className="flex-1" />

        {/* プログレスバー */}
        <div className="h-1 w-full rounded-full bg-gray-100 mb-2 mt-2">
          <div
            className={cn("h-1 rounded-full transition-all", cfg.bar)}
            style={{ width: `${Math.min(Math.max(progressPercent, 0), 100)}%` }}
          />
        </div>

        {/* メタ行: 達成率 + 前月値 */}
        <div className="flex items-center justify-between text-[11px]">
          <span className={cn("font-medium tabular-nums", cfg.color)}>
            {metaLeft}
          </span>
          <span className="text-gray-400">{metaRight}</span>
        </div>
      </div>
    </div>
  );
}
