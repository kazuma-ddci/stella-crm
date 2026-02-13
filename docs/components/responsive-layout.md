# レスポンシブレイアウト設計

このドキュメントはstella-crmのレスポンシブ対応の実装仕様を記述したものです。

---

## 目次

1. [概要](#概要)
2. [ブレークポイント](#ブレークポイント)
3. [サイドバー](#サイドバー)
4. [ヘッダー](#ヘッダー)
5. [メインコンテンツ](#メインコンテンツ)
6. [モーダル/ダイアログ](#モーダルダイアログ)
7. [カード/テーブル](#カードテーブル)
8. [Popover](#popover)

---

## 概要

全画面をスマートフォン(375px)・タブレット(768px)・デスクトップ(1024px+)で適切に表示するレスポンシブ設計。サイドバーの折りたたみトグル、コンテンツの最大幅制限、モーダルの中央バランス表示を実装。

## ブレークポイント

| ブレークポイント | Tailwind | 用途 |
|----------------|----------|------|
| < 768px | デフォルト | モバイル: サイドバー非表示、ハンバーガーメニュー |
| 768px+ | `md:` | タブレット: サイドバー表示(w-52) |
| 1024px+ | `lg:` | デスクトップ: サイドバー拡大(w-64) |

## サイドバー

### 構成

| コンポーネント | ファイル | 役割 |
|--------------|---------|------|
| `Sidebar` | `src/components/layout/sidebar.tsx` | デスクトップ用固定サイドバー |
| `SidebarContent` | 同上 | サイドバー内容（デスクトップ・モバイル共通） |
| `CollapsedNavItem` | 同上 | 折りたたみ時のアイコン表示 |
| Sheet (モバイル) | `src/components/layout/authenticated-layout.tsx` | モバイル用ドロワー |

### サイドバー幅

| 状態 | 幅 | 説明 |
|------|-----|------|
| 展開(md) | `w-52` (208px) | タブレットサイズ |
| 展開(lg+) | `w-64` (256px) | デスクトップサイズ |
| 折りたたみ | `w-16` (64px) | アイコンのみ表示 |
| モバイル | Sheet `w-64` | ドロワーとして表示 |

### 折りたたみ機能

- **状態管理**: `authenticated-layout.tsx` の `sidebarCollapsed` state
- **永続化**: `localStorage` の `sidebar-collapsed` キー
- **hydration安全**: `useEffect` で初期化（サーバーレンダリングは常に展開状態）
- **アニメーション**: `transition-[width] duration-300`

### 折りたたみ時の動作

- トップレベルのナビグループ（Stella、STP等）がアイコンのみで表示
- アイコンに `title` 属性でツールチップ表示
- **リーフ項目**: クリックで直接ナビゲーション
- **親グループ**: クリックでサイドバーを展開
- アクティブ状態は `isNavItemActive()` で子孫を再帰チェック

### トグル操作

| 画面サイズ | 場所 | アイコン | 動作 |
|-----------|------|---------|------|
| モバイル(<md) | ヘッダー左 | `Menu` (ハンバーガー) | Sheet ドロワーを開く |
| デスクトップ(md+) | ヘッダー左 | `PanelLeftClose`/`PanelLeftOpen` | サイドバー折りたたみトグル |
| デスクトップ(md+) | サイドバー下部 | `PanelLeftClose`/`PanelLeftOpen` | サイドバー折りたたみトグル |

### コード例

```tsx
// Sidebar コンポーネント
<div className={cn(
  "hidden md:flex h-full flex-col bg-gray-900 transition-[width] duration-300",
  collapsed ? "w-16" : "w-52 lg:w-64"
)}>
  <SidebarContent collapsed={collapsed} onToggleCollapse={onToggle} />
</div>
```

## ヘッダー

- `src/components/layout/header.tsx`
- レスポンシブパディング: `px-3 sm:px-4 md:px-6`
- モバイルとデスクトップで異なるトグルボタンを表示

## メインコンテンツ

### 最大幅制限

```tsx
<main className="flex-1 overflow-auto bg-gray-50 p-3 sm:p-4 md:p-6">
  <div className="mx-auto max-w-[1600px]">
    {children}
  </div>
</main>
```

- `max-w-[1600px]`: 大画面でコンテンツが横幅いっぱいに広がるのを防止
- `mx-auto`: 中央配置
- 背景色(`bg-gray-50`)は全幅、コンテンツのみ幅制限

### レスポンシブパディング

`p-3 sm:p-4 md:p-6` で画面サイズに応じてパディングを調整。

## モーダル/ダイアログ

### ベースダイアログ (`src/components/ui/dialog.tsx`)

```tsx
// デフォルト設定
className="w-full max-w-[calc(100%-2rem)] sm:max-w-lg p-4 sm:p-6"
```

### モーダル別の幅設定

| モーダル | ファイル | 幅 |
|---------|---------|-----|
| デフォルト | `dialog.tsx` | `sm:max-w-lg` (512px) |
| 契約書追加等 | `contract-add-modal.tsx` | `max-w-2xl` (672px) |
| 提案書/基本契約 | `proposal-modal.tsx`, `master-contract-modal.tsx` | `max-w-3xl` (768px) |
| 代理店契約書 | `contracts-modal.tsx` | `max-w-3xl` (768px) |
| 契約履歴(テーブル付き) | `agent-contract-history-modal.tsx`, `contract-history-modal.tsx` | `max-w-5xl` (1024px) |
| 連絡先管理 | `contacts-modal.tsx` | `max-w-[min(900px,calc(100vw-2rem))]` |
| 銀行口座 | `bank-accounts-modal.tsx` | `max-w-[min(900px,calc(100vw-2rem))]` |
| 入金配分 | `allocation-modal.tsx` | `max-w-[min(800px,calc(100vw-2rem))]` |

### モーダル幅の選び方

- **フォーム入力のみ**: `max-w-lg` ~ `max-w-2xl`
- **フォーム＋テーブル**: `max-w-3xl`
- **大きなテーブル/複雑なレイアウト**: `max-w-5xl`
- **モバイル安全策**: `max-w-[calc(100%-2rem)]` を併記

## カード/テーブル

### カード (`src/components/ui/card.tsx`)

- レスポンシブパディング: `px-4 md:px-6`, `py-4 md:py-6`

### CrudTable (`src/components/crud-table.tsx`)

- 検索バー: `flex flex-wrap gap-2`（モバイルで折り返し）
- フィルターSelect: `w-full sm:w-[180px]`
- ボタングループ: `w-full sm:w-auto sm:ml-auto`

### ダッシュボード

- 見出し: `text-xl sm:text-2xl`
- カードグリッド: `grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4`

## Popover

### EditableCell (`src/components/editable-cell.tsx`)

モバイルでビューポート幅に合わせ、デスクトップで固定幅:

```tsx
// 小さめPopover
className="w-[calc(100vw-2rem)] sm:w-[250px]"

// 中サイズPopover
className="w-[calc(100vw-2rem)] sm:w-[300px]"

// 大きめPopover（テーブル内日付ピッカー等）
className="w-[90vw] sm:w-[400px]"
```

### その他のテーブルPopover

接触履歴テーブル等のPopoverも同パターン:

```tsx
className="w-[calc(100vw-2rem)] sm:w-[400px]"
```

---

## 関連ファイル

| ファイル | 役割 |
|---------|------|
| `src/components/layout/authenticated-layout.tsx` | レイアウト全体制御、サイドバー状態管理 |
| `src/components/layout/sidebar.tsx` | サイドバー（展開/折りたたみ） |
| `src/components/layout/header.tsx` | ヘッダー（トグルボタン） |
| `src/components/ui/dialog.tsx` | ダイアログベース |
| `src/components/ui/card.tsx` | カードベース |
| `src/components/crud-table.tsx` | テーブル検索バー |
| `src/components/editable-cell.tsx` | インライン編集Popover |

## 変更履歴

| 日付 | 変更内容 |
|------|---------|
| 2026-02-13 | 初版作成: 包括的レスポンシブ対応実装 |
