TASK-034 完了しました。実装した内容をまとめます。

## 実装内容

### 1. Server Action: `getProjectDashboard`
**ファイル**: `src/app/stp/finance/overview/actions.ts`

新しいTransaction / InvoiceGroup / PaymentGroupテーブルからデータを取得するServer Action。以下のデータを返却:

- **TransactionSummary**: 売上/経費の合計（税込）、件数、ステータス別集計
- **InvoiceGroupSummary**: 請求グループ総数、ステータス別件数
- **PaymentGroupSummary**: 支払グループ総数、ステータス別件数
- **RecentActivities**: 取引(最新10件)・請求(最新5件)・支払(最新5件)をマージした直近15件
- **MonthlyTrends**: 直近6ヶ月の月別売上/経費/粗利推移

### 2. ダッシュボードページ
**ファイル**: `src/app/stp/finance/overview/page.tsx`

旧STPテーブル（stpRevenueRecord等）を使っていた旧ダッシュボードを、新テーブルベースに全面書き換え:

- **全体サマリー**: 売上合計・経費合計・粗利・取引総数の4カード
- **月別推移テーブル**: 直近6ヶ月の売上/経費/粗利
- **取引ステータス別**: ステータスごとの件数（取引一覧へのリンク付き）
- **請求状況**: 請求グループのステータス別件数（請求書ページへのリンク付き）
- **支払状況**: 支払グループのステータス別件数（支払グループページへのリンク付き）
- **直近のアクティビティ**: 取引・請求・支払の最新アクティビティをタイムライン表示

`npx tsc --noEmit` でコンパイルエラーなしを確認済みです。
