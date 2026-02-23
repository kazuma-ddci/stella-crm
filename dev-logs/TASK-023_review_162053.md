全ての情報が揃いました。レビュー結果をまとめます。

---

## コードレビュー: TASK-023 予実管理画面 (attempt 2)

**コミット**: `dac91f8` feat(TASK-023): 実装 (attempt 2)

### 変更概要

attempt 1 で基本実装（予算CRUD、月コピー、定期取引自動生成、予実比較）が完了。
attempt 2 では以下の3つの改善:

1. **定期取引自動生成の差分レビューダイアログ追加** — 設計書㉒の「既存Budgetがある月は上書きせず差分レビュー表示」要件の実装
2. **予実比較の月フィルタをサーバーサイドに移行** — `month` パラメータをURLクエリに追加し、`getBudgetVsActual` をサーバー側でフィルタ
3. **`accountId` がnullの予算に対する実績マッチング改善** — `categoryLabel` と勘定科目名でフォールバックマッチ

---

### 1. Prismaスキーマ vs 設計書

| 設計書㉒のカラム | Prismaスキーマ | 一致 |
|---|---|---|
| id Int @id @default(autoincrement()) | `prisma/schema.prisma:2899` | OK |
| costCenterId Int? | `:2900` | OK |
| accountId Int? | `:2901` | OK |
| categoryLabel String | `:2902` | OK |
| targetMonth DateTime | `:2903` | OK |
| budgetAmount Int | `:2904` | OK |
| memo String? | `:2905` | OK |
| createdBy/updatedBy | `:2907-2908` | OK |
| Relations (CostCenter, Account, MasterStaff) | `:2913-2916` | OK |

**判定**: 完全一致

### 2. 要望書3.7との整合性

| 要件 | 実装状況 |
|---|---|
| コストセンター別×勘定科目区分×年月で予算設定 | OK — `createBudget` で全項目対応 |
| 毎月同じなら一括コピー可能 | OK — `copyBudgetMonth` |
| 定期取引から固定経費の下書き埋めボタン | OK — `generateBudgetFromRecurring` + 差分プレビュー |
| 予算 vs 仕訳実績の自動比較 | OK — `getBudgetVsActual` |
| 差異・達成率の表示 | OK — `BudgetVsActualTable` |
| 差異が大きいところにアラート | OK — `getAlertLevel` (10%超: warning, 20%超: danger) |
| プロジェクト別にも表示可能 | OK — costCenterIdフィルタ |

### 3. 設計書㉒ Budget自動下書き生成

> 既存Budgetがある月は上書きせず差分レビュー表示

- `previewBudgetFromRecurring`: 各定期取引×月について既存Budgetの有無をチェックし、`status: "create" | "skip"` を返す — **設計通り**
- UIダイアログで新規/スキップをBadgeで視覚的に区別 — 良い
- 全件スキップの場合は「新規作成対象がありません」メッセージ + 生成ボタン無効化 — 良い

### 4. バリデーション（設計書セクション6）

Budget固有のバリデーションは設計書セクション6に明示されていないが、`validateBudgetData`で適切にカバー:
- categoryLabel必須チェック
- targetMonth妥当性チェック + 月初正規化
- budgetAmount整数チェック
- costCenterId/accountId存在チェック
- 重複チェック（同一コストセンター×カテゴリ×月）

### 5. ポリモーフィック参照（設計書6.7）

Budgetテーブルはポリモーフィック参照を使用していないため、該当なし。

### 6. 型安全性・エラーハンドリング

- `RecurringBudgetPreviewItem` 型が適切に定義・エクスポートされている
- Server Action側で`getSession()`による認証チェック済み
- エラーは`throw new Error`で投げ、クライアント側で`toast.error`表示
- `rt.amount!` の非nullアサーション — `amount: { not: null }` フィルタ済みなので安全

### 7. 既存パターンとの一致

- Server Actions + Dialog CRUD パターン — 他の会計ページと一致
- `router.refresh()` でサーバーデータ再取得 — 既存パターン通り
- `submitting` state + `Loader2` スピナー — 既存パターン通り
- `localeCompare("en")` を `getBudgetVsActual` のソートで使用 — サーバーサイドのみで実行されるため、MEMORY.mdのハイドレーション問題には該当しない

---

### 指摘事項

**Minor 1**: `previewBudgetFromRecurring` のプレビューダイアログで `costCenterName` が `RecurringBudgetPreviewItem` 型に含まれているがテーブルに表示されていない。「すべて」表示時にどのコストセンターの予算かわからない。

- `budget-input-table.tsx:581-587` — テーブルヘッダーにコストセンター列がない

**Minor 2**: `previewBudgetFromRecurring` と `generateBudgetFromRecurring` でクエリ・ループロジックが重複している（`actions.ts:379-427` vs `440-500`）。共通のヘルパーに抽出可能。N+1クエリ（各月×各定期取引で`findFirst`）も両方に存在。

**Minor 3**: `actualByAccountName` フォールバック（`actions.ts:696-698`）は `categoryLabel` と勘定科目名の完全一致に依存。手動入力の予算（accountId=null）で、categoryLabelが勘定科目名と微妙に異なる場合（例:「外注費用」vs「外注費」）、実績が0表示になる。UXとしてはaccountIdなし予算の実績表示が以前（常に0）より改善されているが、マッチングの限界を認識しておく必要がある。

**Minor 4**: `getBudgetVsActual` で仕訳明細にcostCenterフィルタが適用されていない（仕訳明細にcostCenterIdが存在しないため）。コストセンター別表示時、予算側はフィルタされるが実績側は全プロジェクトの合算になる可能性がある。設計書の「データモデルと計算ロジック優先。レポートUIの高度な可視化は後続フェーズ」の範囲内と理解。

---

```json
{
  "verdict": "OK",
  "issues": [
    {
      "severity": "minor",
      "file": "src/app/accounting/budget/budget-input-table.tsx",
      "description": "定期取引プレビューダイアログにcostCenterName列が表示されていない。RecurringBudgetPreviewItem型にはcostCenterNameが含まれているが、テーブルのカラムに含まれていないため、「すべて」モードで閲覧時にどのコストセンター向けの予算かわからない",
      "suggestion": "テーブルの「カテゴリ」列の後に「コストセンター」列を追加し、item.costCenterName ?? '全社' を表示する"
    },
    {
      "severity": "minor",
      "file": "src/app/accounting/budget/actions.ts",
      "description": "previewBudgetFromRecurringとgenerateBudgetFromRecurringのクエリ・ループロジックが重複しており、N+1クエリパターンも両方に存在する",
      "suggestion": "共通のヘルパー関数（定期取引取得+月展開+既存チェック）を抽出し、previewとgenerateの両方から呼び出す。既存チェックはfindFirstのループではなくfindManyで一括取得してMapで判定する"
    },
    {
      "severity": "minor",
      "file": "src/app/accounting/budget/actions.ts",
      "description": "accountId=nullの予算の実績マッチングがcategoryLabelと勘定科目名の完全一致に依存するため、手動入力の予算で名称が微妙に異なる場合に実績0になる",
      "suggestion": "将来的にはaccountIdの設定を推奨するUIガイダンスを追加するか、部分一致やfuzzyマッチングを検討。現時点では以前の常に0よりは改善されている"
    },
    {
      "severity": "minor",
      "file": "src/app/accounting/budget/actions.ts",
      "description": "getBudgetVsActualで仕訳明細のcostCenterフィルタリングが未実装。コストセンター別表示時に実績側が全プロジェクト合算になる可能性がある（設計書で後続フェーズ対応の範囲内）",
      "suggestion": "後続フェーズでTransaction→CostCenterの紐づけを経由した仕訳明細のコストセンター別集計を実装する"
    }
  ],
  "summary": "設計書㉒ Budgetおよび要望書3.7の要件を忠実に実装。attempt 2では差分レビューダイアログ（設計書の「差分レビュー表示」要件）、月フィルタのサーバーサイド化、accountId=nullの予算の実績マッチング改善が適切に行われている。Prismaスキーマは設計書と完全一致。指摘はいずれもminorでUX改善やリファクタリング観点のみ。"
}
```
