全3件の修正が完了しました。`tsc --noEmit` もパスしています。

---

### 修正まとめ

**1. [Major] `partially_paid` の二重計上修正** (`actions.ts:177-219`)
- InvoiceGroup の select に `status` を追加
- `partially_paid` 状態の InvoiceGroup に対して、`JournalEntry` → `Reconciliation` 経由で消込済み金額を一括取得
- 予測項目には `totalAmount - 消込済み金額` の残額を使用
- 残額が 0 以下の場合は予測から除外

**2. [Minor] `initialBalanceDate` フィルタ追加** (`actions.ts:106-148`)
- 単一の `groupBy` を `Promise.all` による決済手段ごとの並列クエリに変更
- 各決済手段の `initialBalanceDate` 以降の BankTransaction のみを集計（`gte: pm.initialBalanceDate`）
- CSVインポート等で過去データが入っても二重計上を防止

**3. [Minor] 設計書更新** (`SPEC-ACCOUNTING-001-design.md`)
- 「3.4 OperatingCompanyBankAccount」セクションを追加（`paymentMethodId` カラムと用途の説明）
- PaymentMethod のリレーション一覧に `operatingCompanyBankAccounts` を追加
