TASK-032 の実装が完了しました。

## 実装サマリー

**作成ファイル**: `scripts/migrate-stp-to-accounting.ts`

### 移行対象（設計書 7.4 準拠）

| # | 旧テーブル | 新テーブル | マッピング |
|---|---|---|---|
| 1 | StpRevenueRecord | Transaction | `type="revenue"`, `stpRevenueType=revenueType` |
| 2 | StpExpenseRecord | Transaction | `type="expense"`, `stpExpenseType=expenseType` |
| 3 | StpInvoice | InvoiceGroup | `direction="outgoing"` のみ移行 |
| 4 | StpInvoiceLineItem | Transaction.invoiceGroupId | 請求グループへの紐づけ |
| 5 | StpPaymentTransaction | BankTransaction | `source="legacy"` |
| 6 | StpPaymentAllocation | Reconciliation | JournalEntry中間レコード自動生成 |
| 7 | StpFinanceEditLog | ChangeLog | JSON差分形式に変換 |
| 8 | AccountingTransaction | BankTransaction | `source="legacy"` |
| 9 | AccountingMonthlyClose | MonthlyCloseLog | close/reopenアクションに分解 |

### 主な設計判断

- **ドライラン対応**: `--dry-run` フラグで書き込みなしのプレビューが可能
- **アトミック実行**: 本番モードでは `$transaction` で全ステップをラップ（5分タイムアウト）
- **前提データ自動作成**: Counterparty（取引先）、ExpenseCategory、PaymentMethodを不足分は自動作成
- **IDマッピング管理**: 旧ID→新IDをMapで管理し、ステップ間の紐づけに使用
- **税金計算**: `tax_included` の場合は税抜金額を自動計算して格納
- **ステータス変換**: 旧ステータス値を新システムのステータスフローにマッピング

### 使用方法

```bash
# ドライラン（プレビュー）
npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/migrate-stp-to-accounting.ts --dry-run

# 本番実行
npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/migrate-stp-to-accounting.ts
```
