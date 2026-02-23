全ての情報が揃いました。レビュー結果を報告します。

---

## TASK-007 コードレビュー: 取引一覧画面（attempt 2）

今回のコミットは、前回レビューで指摘された4件（MAJOR 2件、MINOR 2件）の修正です。

### 修正内容の検証

#### 1. [MAJOR修正] サマリー計算の taxType 分岐 — `page.tsx:64-65`

```typescript
const calcTaxIncluded = (r: { amount: number; taxAmount: number; taxType: string }) =>
  r.taxType === "tax_excluded" ? r.amount + r.taxAmount : r.amount;
```

テーブル各行の金額表示ロジック（`transactions-table.tsx:334-336`）と同一の分岐。**修正OK**。

#### 2. [MAJOR修正] テーブル下部サマリーの taxType 分岐 — `transactions-table.tsx:156-157`

```typescript
const calcTaxIncluded = (r: TransactionListItem) =>
  r.taxType === "tax_excluded" ? r.amount + r.taxAmount : r.amount;
```

page.tsx側と同じロジック。`useMemo`内で適切にメモ化。**修正OK**。

#### 3. [MINOR修正] listTransactions の JSDoc — `actions.ts:46`

`/** サーバーサイドページネーション導入時に使用予定 */` コメント追加。使途を明確化。**修正OK**。

#### 4. [MINOR修正] 期間フィルタの独立化 — `actions.ts:66-71`

```typescript
if (filters?.periodFrom) {
  where.periodFrom = { gte: new Date(filters.periodFrom) };
}
if (filters?.periodTo) {
  where.periodTo = { lte: new Date(filters.periodTo) };
}
```

`periodTo` のみ指定時に空オブジェクト `where.periodFrom = {}` が設定される問題が解消。**修正OK**。

---

### 仕様書との整合性（再チェック）

| チェック項目 | 結果 |
|---|---|
| Prismaスキーマと設計書①の一致 | OK — 全カラム一致 |
| 要望書 2.1 のステータス9種 | OK — STATUS_LABELS に全9種 |
| 要望書 2.1 の売上/経費2種別 | OK — typeフィルタ + バッジ |
| 設計書 6.1 論理削除フィルタ | OK — `deletedAt: null` |
| 設計書 6.1 按分/コストセンター排他表示 | OK — allocationTemplate優先 |
| 設計書 6.7 ポリモーフィック排他制約 | N/A — 一覧画面（読取専用） |
| taxType分岐の統一性 | OK — 行表示・page.tsxサマリー・テーブルサマリーの3箇所が統一 |
| localeCompare 回避（MEMORY.md） | OK — `<`/`>` 比較 + 数値引き算 |
| group/row パターン | OK |
| Server/Client コンポーネント分離 | OK |

---

```json
{
  "verdict": "OK",
  "issues": [],
  "summary": "前回レビューで指摘したMAJOR 2件（サマリー計算のtaxType未考慮）とMINOR 2件（デッドコードのJSDoc追加、期間フィルタの独立化）が全て適切に修正されています。taxType分岐ロジックはテーブル各行・page.tsxサマリー・テーブル下部サマリーの3箇所で統一され、税額の二重計上問題が解消されました。設計書①のTransactionテーブル定義、要望書2.1のステータス9種、フィルタ（種別/ステータス/取引先/期間）、ソート機能、ステータスバッジ表示の全要件を満たしています。既存コードパターン（localeCompare回避、group/row、Server/Client分離）にも準拠しており、TASK-007の実装として承認します。"
}
```
