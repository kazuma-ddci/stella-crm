import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * KoutekiSelect
 * 公的制度教育推進協会のフォーム用ネイティブセレクト。
 * shadcn/ui の Select コンポーネントを使わずにシンプルなネイティブ <select> をラップしている。
 * （フォームによっては Radix の Select に置き換え可能）
 */
export interface KoutekiSelectProps extends React.ComponentProps<"select"> {
  invalid?: boolean;
  placeholder?: string;
}

export const KoutekiSelect = React.forwardRef<
  HTMLSelectElement,
  KoutekiSelectProps
>(function KoutekiSelect(
  { className, invalid, placeholder, children, ...props },
  ref,
) {
  return (
    <div className="relative">
      <select
        ref={ref}
        data-slot="kouteki-select"
        aria-invalid={invalid || undefined}
        className={cn(
          "flex h-12 w-full appearance-none rounded-xl border bg-white pl-4 pr-11 text-sm text-slate-900",
          "transition-all duration-150",
          "border-slate-200 hover:border-slate-300",
          "focus-visible:border-blue-500 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-100",
          "disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400",
          "aria-[invalid=true]:border-rose-400 aria-[invalid=true]:focus-visible:ring-rose-100",
          className,
        )}
        {...props}
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-4 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
    </div>
  );
});
