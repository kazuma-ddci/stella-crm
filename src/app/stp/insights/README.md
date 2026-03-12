# STP 経営インサイト

チャットUIで経営データを対話的に確認できるページ。

## ディレクトリ構造

```
src/app/stp/insights/
├── README.md                     # このファイル（設計・運用ガイド）
├── page.tsx                      # ページ（Server Component）
├── types.ts                      # 型定義
├── insight-definitions.ts        # カテゴリ・項目定義（選択肢ツリー）
├── actions.ts                    # Server Actions（データ集計ロジック）
└── components/
    ├── chat-container.tsx         # チャットUI全体
    ├── category-selector.tsx      # カテゴリ/項目選択ボタン
    └── result-display.tsx         # 結果表示（数値/テーブル/グラフ等）
```

## 新しい項目を追加する手順

### 1. `insight-definitions.ts` に項目定義を追加

```typescript
{
  id: "new_item_id",              // ユニークなID（snake_case）
  categoryId: "revenue",          // 既存カテゴリに追加 or 新カテゴリ
  name: "表示名",
  description: "説明文",
  resultType: "number",           // number | breakdown | table | ranking | trend | summary
  params: [                       // パラメータが必要な場合のみ
    { key: "yearMonth", label: "対象月", type: "month" },
  ],
},
```

### 2. `actions.ts` にデータ取得関数を追加

```typescript
// 1. getInsightData() の switch 文に case を追加
case "new_item_id":
  return getNewItemData(yearMonth);

// 2. 実際のデータ取得関数を実装
async function getNewItemData(yearMonth: string): Promise<InsightResult> {
  // Prisma クエリでデータ取得
  // InsightResult 型に合わせて返す
}
```

### 3. 必要に応じて `types.ts` に新しい結果型を追加

通常は既存の6種類（number/breakdown/table/ranking/trend/summary）で十分。
新しい表示形式が必要な場合のみ型を追加。

## カテゴリを追加する手順

### 1. `types.ts` の `InsightCategoryId` に追加

```typescript
export type InsightCategoryId =
  | "revenue"
  | ...
  | "new_category";  // 追加
```

### 2. `insight-definitions.ts` の `INSIGHT_CATEGORIES` に追加

```typescript
{
  id: "new_category",
  name: "カテゴリ名",
  description: "説明",
  icon: "🆕",
},
```

### 3. 項目とServer Actionを上記の手順で追加

## 結果表示タイプ

| タイプ | 用途 | 主なフィールド |
|-------|------|--------------|
| `number` | 単一数値（前月比付き） | value, comparison, subItems |
| `breakdown` | 内訳（比率バー） | total, items[{label, value, percent}] |
| `table` | テーブル一覧 | columns, rows |
| `ranking` | ランキング表示 | items[{rank, name, value}] |
| `trend` | 月別推移（バーチャート） | months[{label, value, target}] |
| `summary` | 複合カード表示 | cards[{label, value}], details |

## 削除する場合

このディレクトリを丸ごと削除 + `sidebar.tsx` の1行を削除するだけで完全に元に戻せる。
DBスキーマ変更なし。既存ファイルへの影響はサイドバーの1行のみ。

## 将来のRAG化について

現在はカテゴリ→項目→パラメータの選択式UI。
将来的にRAG化する場合:
1. `ChatContainer` にテキスト入力フィールドを追加
2. ユーザー入力を解析して適切な `insightId` と `params` にマッピング
3. `actions.ts` のデータ取得関数はそのまま再利用可能
4. 必要に応じてベクトル検索でCRMデータを補完
