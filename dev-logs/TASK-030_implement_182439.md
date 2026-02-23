TASK-030 の実装が完了しました。TypeScriptコンパイルエラーもありません。

## 実装サマリー

### 作成ファイル（3ファイル）

**1. `src/app/accounting/masters/recurring-transactions/actions.ts`** - Server Actions
- `createRecurringTransaction` - 新規作成（全設定項目のバリデーション、FK存在チェック、按分排他チェック付き）
- `updateRecurringTransaction` - 部分更新（既存パターン踏襲）
- `deleteRecurringTransaction` - 論理削除（生成済み取引がある場合は削除不可、無効化を促す）

**2. `src/app/accounting/masters/recurring-transactions/page.tsx`** - Server Component
- `Promise.all` で定期取引一覧 + 全関連マスタ（取引先、費目、コストセンター、按分テンプレート、決済手段、プロジェクト）を並行取得
- 費目は種別（revenue/expense）ごとにグループ分けして `dynamicOptions` として渡す
- 生成済み取引件数（`_count`）も取得

**3. `src/app/accounting/masters/recurring-transactions/recurring-transactions-table.tsx`** - Client Component
- CrudTable ベースの一覧表示（既存マスタ画面パターン踏襲）
- 要望書 2.7.2 の全設定項目を網羅:
  - 種別（売上/経費）、名称、取引先、費目（種別連動）、金額タイプ（固定/変動）
  - 金額・消費税額・税率（固定時のみ表示、`visibleWhen`）
  - 頻度（毎月/毎年/毎週）、実行日、開始日、終了日
  - プロジェクト（按分なし）/ 按分テンプレート、決済手段、プロジェクト、摘要・メモ
- `onFieldChange` で金額変更時に消費税額を自動計算
- `dynamicOptions` で種別に応じた費目フィルタリング
- カスタムレンダラーで選択肢のラベル表示、実行日の曜日表示

### 変更ファイル（1ファイル）

**4. `src/components/layout/sidebar.tsx`** - サイドバーにナビゲーション追加
- `Repeat` アイコンをインポート
- 経理 > マスタ管理 に「定期取引」メニューを追加
