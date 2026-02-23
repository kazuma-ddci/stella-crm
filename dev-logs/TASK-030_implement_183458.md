修正完了です。以下の2点を修正しました。

### 1. (major) `updateRecurringTransaction` に排他制約チェック追加
- `existing` の `select` に `costCenterId`, `allocationTemplateId` を追加（L191）
- DB更新前に、`updateData` で送信された値 or 既存レコードの値をマージして排他チェック（L368-375）
- `createRecurringTransaction` と同じエラーメッセージを使用

### 2. (minor) `deleteRecurringTransaction` に存在/削除済みチェック追加
- 使用中チェックの前に `findUnique` で存在確認と `deletedAt` チェックを追加（L392-398）
- `updateRecurringTransaction` と同じパターン

`npx tsc --noEmit` — コンパイルエラーなしです。
