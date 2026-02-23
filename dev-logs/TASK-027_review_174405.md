全ファイルの確認が完了しました。レビュー結果をまとめます。

---

## TASK-027 コードレビュー: 変更履歴機能 (attempt 2)

### 変更概要

attempt 2 は、attempt 1 で実装された変更履歴機能の**トランザクション整合性修正**がメインです。

| 操作 | 修正内容 |
|------|----------|
| `deleteJournalEntry` | 論理削除 + changelog 記録を `$transaction` で統合 |
| `confirmTransaction` | ステータス更新 + changelog 記録を `$transaction` で統合 |
| `hideTransaction` | 非表示化 + changelog 記録を `$transaction` で統合 |
| `updateAllocationTemplate` | バッチ `$transaction([...])` → インタラクティブ `$transaction(async (tx) => {...})` に変更し、changelog 記録をトランザクション内に移動 |

加えて、未使用コードの削除:
- `changelog/actions.ts`: 未使用の `revalidatePath`, `getSession` import、使われていない `ALLOCATION_TEMPLATE_LINE_LOG_FIELDS` 定数を削除
- `changelog-section.tsx`: 未使用の `Button` import を削除

---

### チェック結果

#### 1. テーブル定義の整合性 (Prismaスキーマ vs 設計書㉚)

設計書㉚の ChangeLog 定義と `prisma/schema.prisma:3117` が完全一致:
- `id`, `tableName`, `recordId`, `changeType`, `oldData`, `newData`, `changedBy`, `changedAt` 全カラム一致
- リレーション `changer → MasterStaff` も一致

#### 2. 要望書6（変更履歴の要望）との整合性

| 要件 | 実装状況 |
|------|----------|
| 6.1 共通変更履歴テーブル（テーブル名、レコードID、変更種別、変更前JSON、変更後JSON、変更者、変更日時） | 全項目実装済み |
| 6.1 1テーブルで全テーブルの変更を管理 | ChangeLog テーブル1つで管理 |
| 6.2 按分テンプレート明細 | `allocation-templates/actions.ts:160` で記録 |
| 6.2 仕訳（監査対象） | `journal/actions.ts` の全CRUD操作で記録 |
| 6.2 取引（金額・ステータスの変更） | `transactions/actions.ts` の全操作（create/update/confirm/return/resubmit/hide）で記録 |

#### 3. 設計書8.4との整合性

| 要件 | 実装状況 |
|------|----------|
| Server Actionで明示的に記録 | 各アクション内で `recordChangeLog` / `recordChangeLogs` を呼出 |
| 対象: Transaction | create/update/confirm/return/resubmit/hide 全6操作で記録 |
| 対象: JournalEntry | create/update/confirm/delete 全4操作で記録 |
| 対象: AllocationTemplateLine | update で記録 |

#### 4. トランザクション整合性

全 `recordChangeLog` / `recordChangeLogs` 呼び出しが `$transaction` 内で `tx` パラメータを渡して実行されていることを確認:
- `createTransaction` → `tx` 渡し済み (`actions.ts:284`)
- `updateTransaction` → `tx` 渡し済み (`actions.ts:418`)
- `confirmTransaction` → `tx` 渡し済み (`actions.ts:609`) **← attempt 2 で修正**
- `returnTransaction` → `tx` 渡し済み (`actions.ts:693`)
- `resubmitTransaction` → `tx` 渡し済み (`actions.ts:767`)
- `hideTransaction` → `tx` 渡し済み (`actions.ts:819`) **← attempt 2 で修正**
- `createJournalEntry` → `tx` 渡し済み (`journal/actions.ts:283`)
- `updateJournalEntry` → `tx` 渡し済み (`journal/actions.ts:380`)
- `confirmJournalEntry` → `tx` 渡し済み (`journal/actions.ts:445`, `476`)
- `deleteJournalEntry` → `tx` 渡し済み (`journal/actions.ts:525`) **← attempt 2 で修正**
- `updateAllocationTemplate` → `tx` 渡し済み (`allocation-templates/actions.ts:175`) **← attempt 2 で修正**

#### 5. UI表示

- 取引詳細画面 (`transactions/[id]/edit/page.tsx:72`) に `ChangeLogSection` コンポーネントを配置
- `getChangeLogsForTransaction` で取引 + 紐づく仕訳の変更履歴を一括取得
- DiffView（更新差分）、CreateView（作成データ）、DeleteView（削除データ）の3パターン表示
- フィールド名の日本語ラベル、ステータスの日本語化、金額フォーマット等の見やすい表示

#### 6. 型安全性・エラーハンドリング

- `recordChangeLog` の `tx?` パラメータは `Prisma.TransactionClient` 型で型安全
- `ChangeLogInput` 型で `changeType` を `"create" | "update" | "delete"` に制限
- `extractChanges` で変更がない場合 `null` を返し、不要なログ記録を防止

---

### 結論

```json
{
  "verdict": "OK",
  "issues": [],
  "summary": "attempt 2 はトランザクション整合性の修正に特化した良いコミットです。attempt 1 で confirmTransaction, hideTransaction, deleteJournalEntry, updateAllocationTemplate の4操作が DB更新とchangelog記録を別々に実行していた問題を修正し、すべての操作で $transaction 内に統合しました。設計書㉚のChangeLogテーブル定義、設計書8.4の記録方針、要望書6の要件すべてに忠実な実装です。必須対象3テーブル（Transaction, JournalEntry, AllocationTemplateLine）の全CRUD操作でchangelogが記録されており、取引詳細画面でのJSON差分表示も実装済みです。"
}
```
