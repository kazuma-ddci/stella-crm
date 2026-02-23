TASK-014 の実装が完了しました。TypeScriptコンパイルエラーもありません。

## 実装内容まとめ

### 作成ファイル（3ファイル）

1. **`src/app/accounting/masters/invoice-templates/actions.ts`** - Server Actions
   - `createInvoiceTemplate` - テンプレート新規作成（法人存在チェック、名称重複チェック、デフォルト排他制御）
   - `updateInvoiceTemplate` - テンプレート更新（部分更新対応、デフォルト排他制御）
   - `deleteInvoiceTemplate` - 論理削除（`deletedAt` 設定）

2. **`src/app/accounting/masters/invoice-templates/page.tsx`** - 一覧ページ（Server Component）
   - InvoiceTemplate（`deletedAt: null`）と OperatingCompany を並行取得
   - 法人別・種別順にソート

3. **`src/app/accounting/masters/invoice-templates/invoice-templates-table.tsx`** - テーブルコンポーネント（Client Component）
   - CrudTable を使用し既存パターンに準拠
   - 運営法人・種別でフィルタリング可能
   - `customFormFields` でメール件名/本文テンプレートにプレビュー機能を実装
   - テンプレート変数（8種類）をサンプル値で置換表示

### 変更ファイル（1ファイル）

4. **`src/components/layout/sidebar.tsx`** - サイドバーのマスタ管理に「請求書テンプレート」を追加

### 主な機能
- 法人別のテンプレート一覧表示・フィルタリング
- 送付用/発行依頼用の種別管理
- メール件名・本文テンプレートの作成・編集
- テンプレート変数（`{{法人名}}`等）のリアルタイムプレビュー
- 法人×種別ごとのデフォルトテンプレート管理（排他制御付き）
- 論理削除による安全な削除
