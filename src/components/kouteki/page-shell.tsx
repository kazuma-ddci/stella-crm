import * as React from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * 公的制度教育推進協会（SLP）ブランドのフォーム用ページラッパー
 *
 * デザイン方針:
 * - 補助金ポータル (`src/components/hojo-portal.tsx`) と同じ思想
 *   - 上部にブランドカラーのグラデーションライン
 *   - 白カード（rounded-2xl border shadow）で囲う
 *   - 余計な装飾は持たない
 * - 公的制度教育推進協会のキーカラーは青系
 *   - グラデ: #1e3a8a → #1d4ed8 → #3b82f6 (blue-800 → blue-700 → blue-500)
 *   - 淡背景: from-slate-50 via-white to-blue-50/40
 *
 * 用途:
 * - 公開フォーム (`/form/slp-*`) のページ全体のラッパー
 * - 中央にロゴ＋協会名＋ページタイトルのヘッダー
 * - 子要素 (children) は本体カードの中身
 *
 * Header / Footer / Hero などの「サイト」っぽい構造は持たない。
 * これは「フォーム1ページ専用」の最小ラッパー。
 */

export const KOUTEKI_GRADIENT =
  "bg-gradient-to-r from-[#1e3a8a] via-[#1d4ed8] to-[#3b82f6]";

/**
 * KoutekiPageShell
 * フォームページ全体ラッパー（白背景＋グラデーションライン＋ロゴヘッダー＋カード）
 */
export function KoutekiPageShell({
  title,
  subtitle,
  children,
  maxWidth = "lg",
  className,
}: {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  /** カードの最大幅 */
  maxWidth?: "md" | "lg" | "xl" | "2xl" | "3xl";
  className?: string;
}) {
  const widthClass = {
    md: "max-w-md",
    lg: "max-w-2xl",
    xl: "max-w-3xl",
    "2xl": "max-w-4xl",
    "3xl": "max-w-5xl",
  }[maxWidth];

  return (
    <div
      className={cn(
        "min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/40 px-4 py-8 sm:py-14",
        "font-[ui-sans-serif,system-ui,'Hiragino_Sans','Noto_Sans_JP','Yu_Gothic_UI','Meiryo',sans-serif]",
        "text-slate-800 antialiased",
        className,
      )}
    >
      <div className={cn("mx-auto w-full", widthClass)}>
        {/* ヘッダー（ロゴ + 協会名 + タイトル） */}
        <header className="mb-6 flex flex-col items-center text-center">
          <KoutekiLogoMark className="h-14 w-14" />
          <p className="mt-3 text-[11px] font-medium tracking-[0.18em] text-slate-500">
            一般社団法人 公的制度教育推進協会
          </p>
          {title && (
            <h1 className="mt-2 text-2xl font-bold leading-tight tracking-tight text-slate-900 sm:text-[26px]">
              {title}
            </h1>
          )}
          {subtitle && (
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-500">
              {subtitle}
            </p>
          )}
        </header>

        {/* 本体カード（上にグラデーションライン） */}
        <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_10px_40px_-24px_rgba(15,30,80,0.25)]">
          <div className={cn("h-1 w-full", KOUTEKI_GRADIENT)} />
          <div className="px-5 py-6 sm:px-8 sm:py-8">{children}</div>
        </div>

        {/* フッターのコピーライト（必要最小限） */}
        <footer className="mt-6 text-center text-[11px] text-slate-400">
          © {new Date().getFullYear()} 一般社団法人 公的制度教育推進協会
        </footer>
      </div>
    </div>
  );
}

/**
 * KoutekiLogoMark
 * 公式ロゴマーク (`/public/images/slp-kouteki-logo.svg`) を表示する。
 * size は className で制御してください（例: `h-12 w-12`）。
 */
export function KoutekiLogoMark({
  className,
  alt = "公的制度教育推進協会",
}: {
  className?: string;
  alt?: string;
}) {
  return (
    <Image
      src="/images/slp-kouteki-logo.svg"
      alt={alt}
      width={128}
      height={128}
      priority
      className={cn("inline-block object-contain", className)}
    />
  );
}

/**
 * KoutekiContainer
 * 必要に応じて中央寄せ・最大幅指定のシンプルラッパー。
 * フォーム以外でも `kouteki` トーンのページを作りたい場合に使う。
 */
export function KoutekiContainer({
  className,
  children,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("mx-auto w-full max-w-3xl px-5 sm:px-8", className)}
      {...props}
    >
      {children}
    </div>
  );
}
