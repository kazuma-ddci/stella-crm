import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * KoutekiButton
 * 公的制度教育推進協会ブランドのボタン。
 *
 * デザイン:
 * - default: 青グラデ塗りつぶし
 * - outline: 白背景＋青枠
 * - subtle:  薄い青背景
 * - ghost:   無背景（テキストリンク）
 *
 * 角丸は rounded-lg（モダンなフォーム向き、pill より控えめ）。
 */
const koutekiButtonVariants = cva(
  cn(
    "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg font-semibold tracking-wide",
    "transition-all duration-150 ease-out",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/50 focus-visible:ring-offset-2",
    "disabled:pointer-events-none disabled:opacity-50",
    "[&_svg]:shrink-0",
  ),
  {
    variants: {
      variant: {
        default: cn(
          "text-white",
          "bg-gradient-to-br from-[#1e3a8a] via-[#1d4ed8] to-[#3b82f6]",
          "shadow-[0_8px_24px_-12px_rgba(29,79,209,0.55)]",
          "hover:brightness-110 hover:shadow-[0_12px_28px_-12px_rgba(29,79,209,0.7)]",
          "active:translate-y-px",
        ),
        outline: cn(
          "border border-blue-200 bg-white text-blue-700",
          "hover:border-blue-400 hover:bg-blue-50",
        ),
        subtle: cn("bg-blue-50 text-blue-700", "hover:bg-blue-100"),
        ghost: cn(
          "text-blue-700",
          "hover:bg-blue-50",
        ),
        destructive: cn(
          "border border-rose-200 bg-white text-rose-600",
          "hover:border-rose-400 hover:bg-rose-50",
        ),
      },
      size: {
        sm: "h-9 px-4 text-xs",
        default: "h-11 px-5 text-sm",
        lg: "h-12 px-7 text-sm",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface KoutekiButtonProps
  extends React.ComponentProps<"button">,
    VariantProps<typeof koutekiButtonVariants> {
  asChild?: boolean;
}

export function KoutekiButton({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: KoutekiButtonProps) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      data-slot="kouteki-button"
      className={cn(koutekiButtonVariants({ variant, size }), className)}
      {...props}
    />
  );
}

export { koutekiButtonVariants };
