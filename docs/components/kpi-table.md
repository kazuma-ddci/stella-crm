# KPIテーブル コンポーネント仕様

## 概要

運用KPIシートで使用するテーブルコンポーネント。週次データの目標・実績・差分を表示する。

## ファイル

- `src/components/kpi-sheet/kpi-table.tsx`
- `src/components/kpi-sheet/kpi-cell.tsx`
- `src/components/kpi-sheet/types.ts`

---

## 配色仕様

### 背景

運用KPIシートのテーブルで、日付や目標ラベルが背景色とかぶって見えにくい問題があった。
また、配色に統一感がなく見た目が良くなかったため、スプレッドシートらしい配色に統一した。

### ヘッダー行（開始/終了）

```tsx
<tr className="bg-gray-700 text-white">
```

- 背景: `bg-gray-700`（濃いグレー）
- 文字: `text-white`

### セクションヘッダー

| セクション | 背景色 | Tailwindクラス |
|-----------|--------|----------------|
| 目標 | 薄いオレンジ/黄色 | `bg-amber-100` |
| 実績 | 薄いティール | `bg-teal-100` |
| 差分 | 薄いグレー | `bg-gray-100` |

```tsx
const SECTION_CONFIG = [
  { type: "target", label: "目標", headerBg: "bg-amber-100" },
  { type: "actual", label: "実績", headerBg: "bg-teal-100" },
  { type: "diff", label: "差分", headerBg: "bg-gray-100" },
];
```

### 手入力セル

```tsx
const cellBg = isManual ? "bg-amber-50" : "bg-white";
```

- 手入力項目: `bg-amber-50`（薄い黄色）
- 計算項目: `bg-white`（白）

---

## 開始日編集ボタン

### 配置

中央揃えで表示する。

```tsx
<button className="inline-flex items-center justify-center gap-1 hover:bg-gray-600 px-1 rounded cursor-pointer whitespace-nowrap text-white">
  <span>{formatDateFull(currentDate)}</span>
  <Pencil className="h-3 w-3 text-white/70" />
</button>
```

### 注意点

- `inline-flex justify-center` で中央揃え
- `text-white` で白文字（濃いグレー背景に対応）
- 鉛筆アイコンは `text-white/70` で少し薄く

---

## 検証方法

1. 運用KPIシート画面（`/stp/companies/[id]/kpi`）を開く
2. 以下を確認：
   - 開始/終了行の日付が白文字で読める
   - 目標/実績/差分のラベルが読める
   - 開始日が中央揃えになっている
   - 配色に統一感がある

---

## 変更履歴

| 日付 | 変更内容 |
|------|---------|
| 2026-02-04 | 配色仕様を確定（bg-gray-700, bg-amber-100, bg-teal-100, bg-gray-100） |
| 2026-02-04 | 開始日編集ボタンの中央揃え対応 |
