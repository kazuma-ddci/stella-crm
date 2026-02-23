全ての修正が完了し、`tsc --noEmit`もパスしました。修正内容のまとめです。

---

## 修正サマリー

### 1. [MAJOR] 入金予定が口座別残高予測に反映されない
- **スキーマ**: `OperatingCompanyBankAccount` に `paymentMethodId Int?` カラムとリレーションを追加
- **マイグレーション**: `20260223073812_add_payment_method_to_bank_account` 作成・適用済み
- **actions.ts**: InvoiceGroupのbankAccount selectに `paymentMethodId` を追加し、forecastItemの `paymentMethodId` に `ig.bankAccount?.paymentMethodId` を設定。これにより、OperatingCompanyBankAccountにPaymentMethodが紐付けられていれば、入金予定が口座別残高予測に正しく反映される

### 2. [MINOR] RecurringTransactionの保存済みtaxAmountを無視
- selectに `taxAmount` を追加
- `rt.taxAmount ?? Math.floor(...)` で保存値を優先使用するよう変更

### 3. [MINOR] forecastDaysのバリデーション不足
- `const raw = Number(params.days); const forecastDays = raw > 0 && raw <= 365 ? raw : 90;` に変更し、NaNや不正値をガード

### 4. [MINOR] getClosingPeriodのコメント不一致
- コメントの例を実際のロジックに合わせて「1月16日〜2月15日」に修正

### 5. [MINOR] N+1クエリパターン
- 決済手段ごとの個別aggregate 2回 → `groupBy` で `paymentMethodId` + `direction` の一括集計に変更し、1クエリで完結するよう改善
