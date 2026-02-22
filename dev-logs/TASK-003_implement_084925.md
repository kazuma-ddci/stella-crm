TASK-003 の実装が完了しました。TypeScriptコンパイルエラーもありません。

## 実装サマリー

### 作成ファイル（3ファイル）

**1. `src/app/accounting/masters/expense-categories/actions.ts`** - Server Actions
- `createExpenseCategory` - 新規作成（名称重複チェック、種別バリデーション付き）
- `updateExpenseCategory` - 編集（フィールドごとの更新、名称重複チェック付き）
- `reorderExpenseCategories` - 表示順の一括並び替え（$transaction使用）
- 全アクションで `createdBy`/`updatedBy` のスタッフID記録
- `revalidatePath` でキャッシュ無効化

**2. `src/app/accounting/masters/expense-categories/expense-categories-table.tsx`** - クライアントコンポーネント
- CrudTable使用、既存のAccountsTableパターンを踏襲
- カラム: 名称、種別（売上用/経費用/両方）のフィルタ付き、デフォルト勘定科目（Accountから選択）、表示順、有効フラグ
- `customRenderers` でデフォルト勘定科目のID→表示名変換
- 並び替え機能対応（SortableItem）

**3. `src/app/accounting/masters/expense-categories/page.tsx`** - サーバーコンポーネント
- ExpenseCategoryとAccountを並列取得（`Promise.all`）
- 論理削除済みレコードを除外（`deletedAt: null`）
- Account一覧を `{code} - {name}` 形式のオプションとして渡す
