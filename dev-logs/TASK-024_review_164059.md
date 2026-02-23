全ファイルの確認が完了しました。レビュー結果をまとめます。

---

## レビュー結果

### コミット概要
`5cce784` feat(TASK-024): 実装 (attempt 2)

attempt 1で作成されたキャッシュフロー予測機能に対する修正コミット。主な変更:
1. `OperatingCompanyBankAccount`に`paymentMethodId`を追加（マイグレーション含む）
2. 残高計算のN+1クエリを`groupBy`で一括集計に最適化
3. InvoiceGroup入金予定に`paymentMethodId`を紐付け（残高推移に反映）
4. 定期取引の`taxAmount`をDB値優先に修正
5. クレカ締め期間のコメント修正
6. `forecastDays`の入力バリデーション追加

### 仕様書との照合

**要望書3.8.1 入出金予測の情報源**:
- 入金予定（請求グループの支払期限）: OK
- 出金予定（取引の支払予定日）: OK
- 出金予定（定期取引の実行日）: OK
- 出金予定（クレカ引落日＋利用額集計）: OK

**要望書3.8.2 口座別残高予測**:
- 初期残高起点の積み上げ計算: OK
- 日別残高推移グラフ: OK（recharts LineChart）
- 残高アラート閾値の警告: OK

**設計書1.2 ページ構成** `/accounting/cashflow`: OK

### 問題点

#### 1. [Major] `partially_paid`の請求グループで金額二重計上

**ファイル**: `src/app/accounting/cashflow/actions.ts:149`

InvoiceGroupの取得条件に`partially_paid`が含まれているが、予測項目には`totalAmount`（全額）を使用している。一方、部分入金は既にBankTransactionとして記録済みで、現在残高（`currentBalance`）に反映されている。

結果として、部分入金済み額が「現在残高」と「将来入金予定」の両方に計上され、キャッシュフロー予測が過大になる。

```typescript
// L149: partially_paid を含む
status: { in: ["sent", "awaiting_accounting", "partially_paid"] },
// ...
// L170: 全額を予測に計上
amount: ig.totalAmount,  // ← 既に部分入金済みの分も含む
```

**修正案**: `partially_paid`の場合は消込済み金額（Reconciliationの合計）を差し引いた残額を使用する。

```typescript
// partially_paid の場合の残額計算例
const reconciledAmount = await prisma.reconciliation.aggregate({
  where: { journalEntry: { invoiceGroupId: ig.id } },
  _sum: { amount: true },
});
const remainingAmount = ig.totalAmount - (reconciledAmount._sum.amount ?? 0);
```

もしくは、簡易的に`partially_paid`をフィルタから除外する（予測精度は落ちるが二重計上は防げる）。

#### 2. [Minor] `initialBalanceDate`を取得するが残高計算で未使用

**ファイル**: `src/app/accounting/cashflow/actions.ts:98,111-118`

`initialBalanceDate`をselectで取得しているが、BankTransactionの集計クエリで`transactionDate`のフィルタに使っていない。現在は全BankTransactionを合算しているため、`initialBalanceDate`以前のBankTransactionが存在した場合に二重計上の可能性がある。

```typescript
// L98: 取得しているが...
initialBalanceDate: true,
// L116: フィルタに使われていない
transactionDate: { lte: today },
// → initialBalanceDateより前のBankTransactionがあると二重計上
```

**修正案**: 各PaymentMethodの`initialBalanceDate`以降のBankTransactionのみを集計するか、`groupBy`使用のためPaymentMethodごとにフィルタが必要な場合は別途対応する。新規システムで過去データが存在しない前提なら現状でも動作するが、将来のCSVインポート等を考慮すると安全策として対応が望ましい。

#### 3. [Minor] スキーマ追加が設計書に未反映

**ファイル**: `prisma/schema.prisma:876`

`OperatingCompanyBankAccount.paymentMethodId`は設計書のテーブル定義に存在しない。キャッシュフロー予測で振込先口座→決済手段を紐づけるために合理的な追加だが、設計書を更新する必要がある。

---

### 良い点
- `groupBy`による一括集計はN+1問題を解消しており、決済手段が増えた場合のパフォーマンスが向上
- `forecastDays`のバリデーション追加（0以下やNaNの防止、365日上限）
- クレカ締め期間のコメント修正（コードロジック自体は正しかった）
- 定期取引の`taxAmount`をDB値優先にしたのは正確な予測に寄与
- クライアントコンポーネントの構成（サマリーカード、アラート、グラフ、入出金テーブル）は要件を適切にカバー

---

```json
{
  "verdict": "NG",
  "issues": [
    {
      "severity": "major",
      "file": "src/app/accounting/cashflow/actions.ts",
      "description": "partially_paid状態のInvoiceGroupでtotalAmount（全額）を入金予定に計上しているが、部分入金はBankTransaction経由で現在残高に既に反映済み。部分入金額が二重計上され、キャッシュフロー予測が過大になる",
      "suggestion": "partially_paidの場合はReconciliation合計を差し引いた残額を使用する。または簡易策としてpartially_paidをフィルタから除外する"
    },
    {
      "severity": "minor",
      "file": "src/app/accounting/cashflow/actions.ts",
      "description": "initialBalanceDateをselectで取得しているがBankTransaction集計のtransactionDateフィルタに使用していない。initialBalanceDate以前のBankTransactionが存在した場合に残高が二重計上される可能性がある",
      "suggestion": "BankTransaction集計時にinitialBalanceDateでフィルタする、またはgroupByが難しい場合は個別クエリで対応する"
    },
    {
      "severity": "minor",
      "file": "prisma/schema.prisma",
      "description": "OperatingCompanyBankAccount.paymentMethodIdは設計書のテーブル定義に存在しない追加カラム",
      "suggestion": "設計書SPEC-ACCOUNTING-001-design.mdのOperatingCompanyBankAccountセクション（またはInvoiceGroupの補足）にpaymentMethodIdの記載を追加する"
    }
  ],
  "summary": "キャッシュフロー予測の要件（入出金予定、口座別残高予測、日別グラフ、アラート）は概ね正しく実装されている。パフォーマンス最適化やバリデーション強化も適切。ただし、partially_paid状態のInvoiceGroupで入金額が二重計上される問題があり、キャッシュフロー予測の正確性に影響するため修正が必要。"
}
```
