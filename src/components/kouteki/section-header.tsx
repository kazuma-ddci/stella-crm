import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * KoutekiSectionHeader
 * カード内のセクション見出し。
 *
 * デザイン:
 * - 左に縦棒（ブランドの青グラデーション）
 * - その横にタイトル
 * - 任意で説明文
 *
 * 補助金ポータルの `PortalCard` の title 部分と思想は同じ。
 */
export function KoutekiSectionHeader({
  title,
  description,
  className,
  right,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  className?: string;
  right?: React.ReactNode;
}) {
  return (
    <div className={cn("flex items-start justify-between gap-4", className)}>
      <div className="flex items-start gap-3">
        <span className="mt-1 inline-block h-5 w-1 rounded-full bg-gradient-to-b from-blue-700 to-blue-400" />
        <div>
          <h2 className="text-base font-bold leading-tight text-slate-900 sm:text-lg">
            {title}
          </h2>
          {description && (
            <p className="mt-1 text-xs leading-relaxed text-slate-500">
              {description}
            </p>
          )}
        </div>
      </div>
      {right && <div className="shrink-0">{right}</div>}
    </div>
  );
}
