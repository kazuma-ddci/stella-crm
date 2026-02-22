修正完了です。レビュー指摘2件の対応内容:

| 指摘 | 修正内容 |
|------|---------|
| **Issue 1**: `reorderAccounts` で `getSession()` 未呼び出し・`updatedBy` 未記録 | L103-105: `getSession()` 追加、L111: 各 `update` の `data` に `updatedBy: staffId` 追加 |
| **Issue 2**: `VALID_CATEGORIES` 重複定義 | L7: モジュールレベル定数 `as const` として1箇所に集約。`createAccount`/`updateAccount` 内の個別定義を削除 |

`npx tsc --noEmit` でコンパイルエラーなしを確認済みです。
