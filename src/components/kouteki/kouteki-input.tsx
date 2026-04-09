import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * KoutekiInput
 * 公的制度教育推進協会のフォーム用テキスト入力。
 * - 角丸大きめ・薄いグレー枠
 * - フォーカス時に青リング
 * - エラー時に赤枠
 */
export interface KoutekiInputProps extends React.ComponentProps<"input"> {
  invalid?: boolean;
}

export const KoutekiInput = React.forwardRef<HTMLInputElement, KoutekiInputProps>(
  function KoutekiInput({ className, invalid, type = "text", ...props }, ref) {
    return (
      <input
        ref={ref}
        type={type}
        data-slot="kouteki-input"
        aria-invalid={invalid || undefined}
        className={cn(
          "flex h-12 w-full rounded-xl border bg-white px-4 text-sm text-slate-900 placeholder:text-slate-400",
          "transition-all duration-150",
          "border-slate-200 hover:border-slate-300",
          "focus-visible:border-blue-500 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-100",
          "disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400",
          "aria-[invalid=true]:border-rose-400 aria-[invalid=true]:focus-visible:ring-rose-100",
          className,
        )}
        {...props}
      />
    );
  },
);
