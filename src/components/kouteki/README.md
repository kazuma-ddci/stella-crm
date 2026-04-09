# Kouteki Design Components

一般社団法人 **公的制度教育推進協会 (SLP)** ブランド用の最小限のデザイン部品です。
公開フォーム（`/form/slp-*`）で **色味・フォント・ボタン・カードスタイル** を揃えるためだけのコンポーネントで、サイトのヘッダー/フッター/ヒーローのようなページ構造は持ちません。

設計思想は ALKES ポータル (`src/components/alkes-portal.tsx`) と同じです。

---

## デザイントークン

| 用途 | 値 |
| --- | --- |
| メインカラー（青） | `text-blue-700` / `bg-blue-600` / `border-blue-200` |
| グラデ（強調） | `from-[#1e3a8a] via-[#1d4ed8] to-[#3b82f6]` (`KOUTEKI_GRADIENT`) |
| ロゴマーク | `/public/images/slp-kouteki-logo.svg` |
| 文字色 | `text-slate-900` (見出し) / `text-slate-700` / `text-slate-500` (補足) |
| カード | 白背景 + `border-slate-200` + `rounded-xl/2xl` + 柔らかい影 |
| 角丸 | `rounded-2xl` (ページカード) / `rounded-xl` (内側カード) / `rounded-lg` (ボタン・入力) |
| フォント | Noto Sans JP / Hiragino Sans / Yu Gothic UI 系 |
| ページ背景 | `bg-gradient-to-br from-slate-50 via-white to-blue-50/40` |

---

## エクスポート一覧

### レイアウト

- `KoutekiPageShell` — フォームページ全体ラッパー（青グラデ上線 + ロゴヘッダー + 中央カード + フッター）
- `KoutekiContainer` — 中央寄せの汎用ラッパー
- `KoutekiLogoMark` — `public/images/slp-kouteki-logo.svg` を表示
- `KOUTEKI_GRADIENT` — グラデーションのTailwindクラス文字列（再利用可）

### セクション見出し

- `KoutekiSectionHeader` — カード内のセクション見出し（左に縦棒アクセント）

### カード

- `KoutekiCard` (`variant: "default" | "ghost" | "outline"`)
- `KoutekiCardHeader`, `KoutekiCardTitle`, `KoutekiCardDescription`, `KoutekiCardContent`, `KoutekiCardFooter`

### ボタン

- `KoutekiButton` (`variant: "default" | "outline" | "subtle" | "ghost" | "destructive"`, `size: "sm" | "default" | "lg"`)

### フォーム要素

- `KoutekiInput`
- `KoutekiTextarea`
- `KoutekiSelect`
- `KoutekiCheckbox`
- `KoutekiFormField`, `KoutekiFormStack`

---

## 使い方の例

```tsx
import {
  KoutekiPageShell,
  KoutekiCard,
  KoutekiCardContent,
  KoutekiSectionHeader,
  KoutekiFormStack,
  KoutekiFormField,
  KoutekiInput,
  KoutekiTextarea,
  KoutekiCheckbox,
  KoutekiButton,
} from "@/components/kouteki";

export default function MyForm() {
  return (
    <KoutekiPageShell
      title="お問い合わせフォーム"
      subtitle="必要事項をご記入の上、送信してください。"
    >
      <KoutekiFormStack>
        <KoutekiSectionHeader
          title="基本情報"
          description="お名前とご連絡先を入力してください。"
        />
        <KoutekiFormField label="お名前" required>
          <KoutekiInput placeholder="山田 太郎" />
        </KoutekiFormField>
        <KoutekiFormField label="メールアドレス" required>
          <KoutekiInput type="email" placeholder="taro@example.com" />
        </KoutekiFormField>
        <KoutekiFormField label="お問い合わせ内容">
          <KoutekiTextarea placeholder="自由記入" />
        </KoutekiFormField>
        <KoutekiCheckbox>プライバシーポリシーに同意します</KoutekiCheckbox>
        <div className="flex justify-center pt-2">
          <KoutekiButton size="lg">送信する</KoutekiButton>
        </div>
      </KoutekiFormStack>
    </KoutekiPageShell>
  );
}
```

---

## 実装例

公開フォームでの実装例は下記を参照:

- `src/components/slp/slp-document-form-shell.tsx` — 提出書類フォーム共通シェル
- `src/app/form/slp-initial-documents/page.tsx` — 初回提出書類フォーム
- `src/app/form/slp-additional-documents/page.tsx` — 追加提出書類フォーム
