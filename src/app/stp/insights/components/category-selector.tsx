"use client";

import { cn } from "@/lib/utils";
import type { InsightCategory, InsightItem, InsightParamDef } from "../types";

export function CategoryGrid({
  categories,
  onSelect,
  disabled,
}: {
  categories: InsightCategory[];
  onSelect: (category: InsightCategory) => void;
  disabled?: boolean;
}) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {categories.map((cat) => (
        <button
          key={cat.id}
          onClick={() => !disabled && onSelect(cat)}
          disabled={disabled}
          className="flex flex-col items-center gap-1 rounded-lg border border-gray-200 bg-white p-3 text-sm shadow-sm transition-all hover:border-blue-300 hover:bg-blue-50 hover:shadow-md active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50"
        >
          <span className="text-xl">{cat.icon}</span>
          <span className="font-medium text-gray-900">{cat.name}</span>
          <span className="text-xs text-gray-500 line-clamp-1">{cat.description}</span>
        </button>
      ))}
    </div>
  );
}

export function ItemGrid({
  items,
  onSelect,
  disabled,
}: {
  items: InsightItem[];
  onSelect: (item: InsightItem) => void;
  disabled?: boolean;
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {items.map((item) => (
        <button
          key={item.id}
          onClick={() => !disabled && onSelect(item)}
          disabled={disabled}
          className="flex flex-col items-start gap-0.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-left text-sm shadow-sm transition-all hover:border-blue-300 hover:bg-blue-50 hover:shadow-md active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50"
        >
          <span className="font-medium text-gray-900">{item.name}</span>
          <span className="text-xs text-gray-500 line-clamp-1">{item.description}</span>
        </button>
      ))}
    </div>
  );
}

export function MonthParamSelector({
  params,
  defaultMonth,
  onSubmit,
}: {
  params: InsightParamDef[];
  defaultMonth: string;
  onSubmit: (values: Record<string, string | number>) => void;
}) {
  // 月選択のみ（現時点ではmonthタイプのみ対応）
  const monthParam = params.find((p) => p.type === "month");
  if (!monthParam) {
    // パラメータ不要の場合はすぐにsubmit
    onSubmit({});
    return null;
  }

  // 月の選択肢を生成（過去12ヶ月 + 来月）
  const months: string[] = [];
  const now = new Date();
  for (let i = -1; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }

  return (
    <div className="flex flex-wrap gap-2">
      {months.map((m) => (
        <button
          key={m}
          onClick={() => onSubmit({ [monthParam.key]: m })}
          className={cn(
            "rounded-lg border px-3 py-1.5 text-sm transition-all hover:border-blue-300 hover:bg-blue-50 active:scale-[0.98]",
            m === defaultMonth
              ? "border-blue-400 bg-blue-50 font-medium text-blue-700"
              : "border-gray-200 bg-white text-gray-700"
          )}
        >
          {m}
        </button>
      ))}
    </div>
  );
}

export function NavigationButtons({
  onBackToCategories,
  onBackToItems,
  categoryName,
}: {
  onBackToCategories: () => void;
  onBackToItems?: () => void;
  categoryName?: string;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <button
        onClick={onBackToCategories}
        className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700 transition-all hover:border-gray-300 hover:bg-gray-50 active:scale-[0.98]"
      >
        最初に戻る
      </button>
      {onBackToItems && categoryName && (
        <button
          onClick={onBackToItems}
          className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-sm text-blue-700 transition-all hover:border-blue-300 hover:bg-blue-100 active:scale-[0.98]"
        >
          {categoryName}の別の項目を見る
        </button>
      )}
    </div>
  );
}
