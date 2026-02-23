TASK-027 の実装が完了しました。以下が実装内容のサマリです。

## 実装内容

### 新規作成ファイル

1. **`src/app/accounting/changelog/actions.ts`** - 変更履歴のServer Actions
   - `recordChangeLog()` - 単一の変更履歴を記録（トランザクション対応）
   - `recordChangeLogs()` - 複数の変更履歴を一括記録
   - `getChangeLogs()` - 特定テーブル・レコードの変更履歴取得
   - `getChangeLogsForTransaction()` - 取引+紐づく仕訳の変更履歴を一括取得
   - `extractChanges()` - 2つのオブジェクトの差分を抽出するヘルパー
   - `pickRecordData()` - レコードから記録対象フィールドを抽出するヘルパー
   - 各テーブルの記録フィールド定義（`TRANSACTION_LOG_FIELDS`, `JOURNAL_ENTRY_LOG_FIELDS`, `ALLOCATION_TEMPLATE_LINE_LOG_FIELDS`）

2. **`src/app/accounting/changelog/changelog-section.tsx`** - 変更履歴表示UIコンポーネント
   - 取引に紐づく全変更履歴をタイムライン形式で表示
   - 作成/更新/削除のバッジ付き
   - フィールドごとの差分表示（旧値→新値）
   - JSON差分の見やすい日本語ラベル付き表示
   - 展開/折りたたみ対応

### 変更したファイル

3. **`src/app/accounting/transactions/[id]/edit/page.tsx`** - 取引詳細画面に変更履歴セクションを追加

4. **`src/app/accounting/transactions/actions.ts`** - 取引のServer Actionsに変更履歴記録を統合
   - `createTransaction` → create記録
   - `updateTransaction` → 差分のみupdate記録
   - `confirmTransaction` → ステータス変更記録
   - `returnTransaction` → ステータス変更記録
   - `resubmitTransaction` → ステータス変更記録
   - `hideTransaction` → ステータス変更記録

5. **`src/app/accounting/journal/actions.ts`** - 仕訳のServer Actionsに変更履歴記録を統合
   - `createJournalEntry` → create記録
   - `updateJournalEntry` → 差分のみupdate記録
   - `confirmJournalEntry` → ステータス変更記録（紐づく取引のステータス変更も記録）
   - `deleteJournalEntry` → delete記録

6. **`src/app/accounting/masters/allocation-templates/actions.ts`** - 按分テンプレート更新時にAllocationTemplateLineの変更履歴を記録
