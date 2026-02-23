TASK-024 の実装が完了しました。以下が実装内容のサマリーです。

## 実装内容

### 1. Server Action (`actions.ts`)
**`getCashflowForecast(forecastDays)`** - キャッシュフロー予測データを計算

- **入金予定**: `InvoiceGroup.paymentDueDate` から（ステータス: sent / awaiting_accounting / partially_paid）
- **出金予定**:
  - `Transaction.paymentDueDate`（経費で未払いのもの）
  - `RecurringTransaction`（アクティブな定期取引を具体的な日付に展開）
  - クレジットカード引落（締め期間の利用額を集計し、引落日に計上）
- **口座別残高予測**: `PaymentMethod.initialBalance` + 入出金実績を起点に、予測入出金を日別に積み上げ
- **残高アラート**: 閾値を下回る最初の日付を検出

### 2. ページ (`page.tsx`)
- Server Component。`searchParams.days` で予測期間（30/60/90/180日）を受け取り

### 3. クライアントコンポーネント (`cashflow-client.tsx`)
- **サマリーカード**: 現在残高合計、入金予定合計、出金予定合計、差引
- **残高アラート**: 閾値を下回る見込みの警告表示
- **口座別残高カード**: 各決済手段の現在残高
- **日別残高推移グラフ**: recharts の LineChart で合計＋口座別の推移を表示
- **入金予定テーブル**: 日付、区分、内容、入金先、金額
- **出金予定テーブル**: 日付、区分、内容、出金元、金額

### 4. サイドバー
- 経理セクションに「予実管理」(`/accounting/budget`) と「キャッシュフロー」(`/accounting/cashflow`) のリンクを追加

### 5. 依存パッケージ
- `recharts` を新規インストール（日別残高推移グラフ用）
