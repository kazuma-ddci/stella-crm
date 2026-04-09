import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * KoutekiTextarea
 * 公的制度教育推進協会のフォーム用テキストエリア。
 * KoutekiInput とビジュアルを揃えてある（角丸・青フォーカスリング）。
 */
export interface KoutekiTextareaProps
  extends React.ComponentProps<"textarea"> {
  invalid?: boolean;
}

export const KoutekiTextarea = React.forwardRef<
  HTMLTextAreaElement,
  KoutekiTextareaProps
>(function KoutekiTextarea({ className, invalid, rows = 5, ...props }, ref) {
  return (
    <textarea
      ref={ref}
      rows={rows}
      data-slot="kouteki-textarea"
      aria-invalid={invalid || undefined}
      className={cn(
        "flex w-full rounded-xl border bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400",
        "transition-all duration-150",
        "border-slate-200 hover:border-slate-300",
        "focus-visible:border-blue-500 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-100",
        "disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400",
        "aria-[invalid=true]:border-rose-400 aria-[invalid=true]:focus-visible:ring-rose-100",
        "resize-y",
        className,
      )}
      {...props}
    />
  );
});
