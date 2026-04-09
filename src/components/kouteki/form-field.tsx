import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * KoutekiFormField
 * フォーム1項目分のラッパー。
 * - ラベル
 * - 必須バッジ
 * - 説明（任意）
 * - 入力要素 (children)
 * - エラーメッセージ
 *
 * 例:
 * ```tsx
 * <KoutekiFormField label="お名前" required>
 *   <KoutekiInput placeholder="山田 太郎" />
 * </KoutekiFormField>
 * ```
 */
export function KoutekiFormField({
  label,
  required,
  description,
  error,
  children,
  className,
  htmlFor,
}: {
  label: React.ReactNode;
  required?: boolean;
  description?: React.ReactNode;
  error?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  htmlFor?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex items-center gap-2">
        <label
          htmlFor={htmlFor}
          className="text-sm font-semibold text-slate-800"
        >
          {label}
        </label>
        {required && (
          <span className="inline-flex h-5 items-center justify-center rounded-md bg-rose-50 px-1.5 text-[10px] font-semibold text-rose-600">
            必須
          </span>
        )}
      </div>
      {description && (
        <p className="text-xs leading-relaxed text-slate-500">{description}</p>
      )}
      {children}
      {error && <p className="text-xs font-medium text-rose-600">{error}</p>}
    </div>
  );
}

/**
 * KoutekiFormStack
 * フォームフィールドを縦に並べる（gap一定の Stack）。
 */
export function KoutekiFormStack({
  className,
  children,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      {children}
    </div>
  );
}
