TASK-002: 勘定科目マスタ管理画面の実装が完了しました。

## 実装内容

### 作成ファイル
1. **`src/app/accounting/masters/accounts/actions.ts`** — Server Actions
   - `createAccount`: 新規作成（科目コード重複チェック付き）
   - `updateAccount`: 編集（科目コード重複チェック付き、変更フィールドのみ更新）
   - `reorderAccounts`: 表示順の並び替え

2. **`src/app/accounting/masters/accounts/accounts-table.tsx`** — テーブルコンポーネント（Client Component）
   - CrudTableを使用し、科目コード・科目名・区分・表示順・有効フラグのカラム定義
   - 区分はselect（資産/負債/収益/費用）
   - 科目コード・科目名・区分でフィルタリング可能
   - 並び替え機能付き（SortableItem）

3. **`src/app/accounting/masters/accounts/page.tsx`** — ページコンポーネント（Server Component）
   - Prismaから全勘定科目をdisplayOrder→idでソートして取得
   - Card + AccountsTableで一覧表示

### 変更ファイル
4. **`src/components/layout/sidebar.tsx`** — サイドバーに「勘定科目」リンクを追加（`/accounting/masters/accounts`、BookOpenアイコン）

### 設計書準拠
- Accountテーブルのカラム（code, name, category, displayOrder, isActive, createdBy, updatedBy）に完全対応
- `code` のunique制約に基づく重複チェック実装済み
- `createdBy` / `updatedBy` にセッションユーザーのIDを記録

### TypeScriptコンパイル
- `npx tsc --noEmit` エラーなし
