"use client";

/**
 * 補助金外部フォーム デザインコンポーネント
 *
 * ALKESポータル(teal/green)とは異なるデザイン。
 * カラー: 深いネイビーブルー (#1e3a5f) をアクセントに、
 *         温かみのあるライトベージュ背景 (#faf8f5)
 * 用途: 補助金関連の外部公開フォーム
 */

import { cn } from "@/lib/utils";

// ========== フォームレイアウト ==========
export function HojoFormLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#faf8f5] py-8 px-4">
      <div className="max-w-[720px] mx-auto space-y-4">
        {children}
      </div>
    </div>
  );
}

// ========== フォームヘッダー ==========
export function HojoFormHeader({
  title,
  description,
  requiredNote,
}: {
  title: string;
  description?: string;
  requiredNote?: string;
}) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="h-2 bg-gradient-to-r from-[#1e3a5f] via-[#2c5282] to-[#3182ce]" />
      <div className="px-7 py-6">
        <h1 className="text-2xl font-bold text-[#1e3a5f] leading-snug">
          {title}
        </h1>
        {description && (
          <p className="text-sm text-gray-600 mt-3 leading-relaxed">
            {description}
          </p>
        )}
        {requiredNote && (
          <p className="text-sm text-red-500 mt-3 font-medium">{requiredNote}</p>
        )}
      </div>
    </div>
  );
}

// ========== セクションカード ==========
export function HojoFormSection({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden", className)}>
      <div className="bg-[#1e3a5f] px-6 py-3">
        <h2 className="text-white font-semibold text-[15px]">{title}</h2>
      </div>
      {description && (
        <p className="text-xs text-gray-500 px-7 pt-4 leading-relaxed">{description}</p>
      )}
      <div className="px-7 py-5">
        {children}
      </div>
    </div>
  );
}

// ========== 送信完了画面 ==========
export function HojoFormComplete({
  title,
  message,
}: {
  title: string;
  message: string;
}) {
  return (
    <div className="min-h-screen bg-[#faf8f5] flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="h-2 bg-gradient-to-r from-[#1e3a5f] via-[#2c5282] to-[#3182ce]" />
        <div className="p-8 text-center space-y-4">
          <div className="w-14 h-14 mx-auto rounded-full bg-green-50 flex items-center justify-center">
            <svg className="w-7 h-7 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-[#1e3a5f]">{title}</h2>
          <p className="text-sm text-gray-600">{message}</p>
        </div>
      </div>
    </div>
  );
}

// ========== 送信ボタンエリア ==========
export function HojoFormActions({
  onSubmit,
  onClear,
  submitting,
}: {
  onSubmit: () => void;
  onClear: () => void;
  submitting: boolean;
}) {
  return (
    <div className="flex justify-between items-center pt-2 pb-10">
      <button
        type="button"
        onClick={onSubmit}
        disabled={submitting}
        className={cn(
          "px-10 py-3 rounded-xl text-white font-semibold text-sm transition-all",
          submitting
            ? "bg-gray-400 cursor-not-allowed"
            : "bg-[#1e3a5f] hover:bg-[#2c5282] active:bg-[#1a365d] shadow-sm hover:shadow"
        )}
      >
        {submitting ? (
          <span className="flex items-center gap-2">
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            送信中...
          </span>
        ) : (
          "送信"
        )}
      </button>
      <button
        type="button"
        onClick={onClear}
        className="text-sm text-[#2c5282] hover:text-[#1e3a5f] hover:underline transition-colors"
      >
        フォームをクリア
      </button>
    </div>
  );
}
