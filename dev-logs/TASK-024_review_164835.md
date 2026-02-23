全ファイルの確認が完了しました。レビュー結果をまとめます。

---

## レビュー結果: TASK-024 キャッシュフロー予測画面 (attempt 3)

### コミット: `7f11691` feat(TASK-024): 実装 (attempt 3)

### 変更概要
attempt 2 からの修正として、主に以下2点を改善:
1. **残高計算の `initialBalanceDate` 対応**: 各決済手段ごとに `initialBalanceDate` 以降のトランザクションのみ集計するよう変更（一括groupByから個別Promise.allへ）
2. **一部入金済み（partially_paid）請求グループの残額計算**: 消込済み金額を `JournalEntry → Reconciliation` 経由で取得し、残額のみを入金予定に含めるロジック追加

---

### チェック結果

#### 1. 仕様書との整合性

| 要望書 3.8 の要件 | 実装状況 |
|---|---|
| 入金予定（請求グループの支払期限から） | OK - InvoiceGroup の `paymentDueDate` で取得。ステータス `sent`, `awaiting_accounting`, `partially_paid` を対象 |
| 出金予定（取引の支払予定日） | OK - Transaction(expense) の `paymentDueDate` で取得 |
| 出金予定（定期取引の実行日） | OK - RecurringTransaction を `expandRecurringDates` で日付展開 |
| 出金予定（クレカ引落日＋利用額集計） | OK - `closingDay`/`paymentDay` から締め期間を算出し `BankTransaction` を集計 |
| 口座別残高予測（初期残高起点の積み上げ計算） | OK - `initialBalance` + 入金 - 出金で現在残高を計算し、予測項目を積み上げ |
| 日別残高推移グラフ | OK - `dailyBalances` 配列を生成、Recharts LineChart で描画 |
| 残高アラート閾値の警告 | OK - `balanceAlertThreshold` を下回る最初の日をアラートに記録 |

#### 2. テーブル定義の整合性

- `OperatingCompanyBankAccount.paymentMethodId`: Prismaスキーマ (line 876) と設計書 3.4 が一致 OK
- `PaymentMethod` の relation 名: 設計書diffでは `operatingCompanyBankAccounts` だが、Prismaスキーマでは `bankAccounts` (line 2808) → **minor不一致**（コード側は正しい）

#### 3. バリデーション・エラーハンドリング

- 設計書セクション6に定義されたバリデーションルールのうち、キャッシュフロー予測（読み取り専用操作）に直接関わるものはない → 該当なし
- ポリモーフィック参照の排他制約 (6.7): 本Server Actionは読み取りのみなので対象外 → OK

#### 4. TypeScript型安全性

- 型定義(`CashflowForecastItem`, `PaymentMethodBalance`, `DailyBalance`, `CashflowForecastData`)が適切に定義 → OK
- nullable のハンドリング (`?? 0`, `?? null`) が適切 → OK

#### 5. 既存コードパターンとの整合

- `"use server"` ディレクティブ、Prisma使用、`deletedAt: null` フィルタパターンに準拠 → OK
- ページ構成 (page.tsx → Server Component → Client Component) パターンに準拠 → OK

---

### 発見した問題

**P1 (Major)**: `actions.ts:184` - partially_paid の消込金額取得クエリで `deletedAt: null` フィルタが欠落

```typescript
// 現在のコード (line 184)
const journalEntries = await prisma.journalEntry.findMany({
  where: { invoiceGroupId: { in: partiallyPaidIds } },
  // ← deletedAt: null が欠落
```

`JournalEntry` は `deletedAt` を持つ（Prismaスキーマ line 2587）。論理削除された仕訳のreconciliation金額も集計されてしまうため、残額が過小計算される可能性がある。

**P2 (Minor)**: 設計書の PaymentMethod relation 名が Prisma スキーマと不一致

設計書 diff で追加された `operatingCompanyBankAccounts` は、Prismaスキーマでは `bankAccounts` (line 2808)。コード上の影響はないが、設計書の正確性の問題。

---

```json
{
  "verdict": "NG",
  "issues": [
    {
      "severity": "major",
      "file": "src/app/accounting/cashflow/actions.ts",
      "description": "partially_paid の消込金額取得で JournalEntry の deletedAt: null フィルタが欠落。論理削除された仕訳の reconciliation 金額も合算され、入金予定の残額が過小計算される可能性がある",
      "suggestion": "where 句に deletedAt: null を追加: `where: { invoiceGroupId: { in: partiallyPaidIds }, deletedAt: null }`"
    },
    {
      "severity": "minor",
      "file": "docs/specs/SPEC-ACCOUNTING-001-design.md",
      "description": "PaymentMethod モデルの relation 名が Prisma スキーマと不一致。設計書では operatingCompanyBankAccounts、Prisma スキーマでは bankAccounts",
      "suggestion": "設計書の relation 名を bankAccounts に修正するか、Prisma スキーマの名前に合わせる"
    }
  ],
  "summary": "キャッシュフロー予測の主要機能（入金予定、出金予定、口座別残高予測、日別残高推移グラフ、残高アラート）は要望書3.8の仕様を網羅しており、attempt 3 で initialBalanceDate 対応と partially_paid 残額計算が適切に追加された。ただし partially_paid の消込金額取得クエリに deletedAt フィルタ漏れが1件あり、修正が必要。"
}
```
