import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * KoutekiCard
 * シンプルな白カード。フォーム内のグルーピング・サブカードに使う。
 *
 * variant:
 * - "default": 白背景・薄い境界線・柔らかい影（補助金ポータルの `PortalCard` 相当）
 * - "ghost":   背景は淡い青、影なし（強調しすぎないサブカード）
 * - "outline": 影なし、境界線のみ（より控えめ）
 */
export function KoutekiCard({
  className,
  variant = "default",
  children,
  ...props
}: React.ComponentProps<"div"> & {
  variant?: "default" | "ghost" | "outline";
}) {
  return (
    <div
      data-slot="kouteki-card"
      className={cn(
        "rounded-xl border",
        variant === "default" &&
          "border-slate-200 bg-white shadow-[0_8px_28px_-20px_rgba(15,30,80,0.25)]",
        variant === "ghost" && "border-blue-100 bg-blue-50/40",
        variant === "outline" && "border-slate-200 bg-white",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function KoutekiCardHeader({
  className,
  children,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "flex flex-col gap-2 border-b border-slate-100 px-6 pb-4 pt-5",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function KoutekiCardTitle({
  className,
  children,
  ...props
}: React.ComponentProps<"h3">) {
  return (
    <h3
      className={cn(
        "text-base font-bold tracking-tight text-slate-900",
        className,
      )}
      {...props}
    >
      {children}
    </h3>
  );
}

export function KoutekiCardDescription({
  className,
  children,
  ...props
}: React.ComponentProps<"p">) {
  return (
    <p
      className={cn("text-xs leading-relaxed text-slate-500", className)}
      {...props}
    >
      {children}
    </p>
  );
}

export function KoutekiCardContent({
  className,
  children,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div className={cn("px-6 py-5", className)} {...props}>
      {children}
    </div>
  );
}

export function KoutekiCardFooter({
  className,
  children,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 border-t border-slate-100 px-6 py-4",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
