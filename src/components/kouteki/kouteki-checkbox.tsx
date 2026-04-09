import * as React from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * KoutekiCheckbox
 * シンプルなネイティブ checkbox をスタイリングしたコンポーネント。
 * - 角丸・青チェック
 * - children に label テキストを渡せる
 */
export interface KoutekiCheckboxProps
  extends Omit<React.ComponentProps<"input">, "type" | "children"> {
  children?: React.ReactNode;
  checkboxClassName?: string;
}

export const KoutekiCheckbox = React.forwardRef<
  HTMLInputElement,
  KoutekiCheckboxProps
>(function KoutekiCheckbox(
  { className, checkboxClassName, children, ...props },
  ref,
) {
  return (
    <label
      className={cn(
        "group inline-flex cursor-pointer select-none items-center gap-3",
        props.disabled && "cursor-not-allowed opacity-60",
        className,
      )}
    >
      <span className="relative inline-flex">
        <input
          ref={ref}
          type="checkbox"
          className={cn(
            "peer size-5 cursor-pointer appearance-none rounded-md border border-slate-300 bg-white",
            "transition-all",
            "checked:border-blue-600 checked:bg-blue-600",
            "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-100",
            "disabled:cursor-not-allowed",
            checkboxClassName,
          )}
          {...props}
        />
        <Check
          className="pointer-events-none absolute left-0.5 top-0.5 size-4 text-white opacity-0 peer-checked:opacity-100"
          strokeWidth={3}
        />
      </span>
      {children && (
        <span className="text-sm leading-snug text-slate-700">{children}</span>
      )}
    </label>
  );
});
