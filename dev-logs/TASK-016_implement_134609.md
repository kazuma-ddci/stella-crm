TASK-016 の実装が完了しました。以下が実装内容のサマリーです。

## 実装内容

### 作成ファイル

**1. `src/app/accounting/dashboard/actions.ts`** - Server Action
- `getDashboardData()` - ダッシュボードに必要な全データを取得
- `Promise.all` による並列クエリで効率的にデータ取得
- 按分未確定の計算には `$queryRaw` で正確なカウント

**2. `src/app/accounting/dashboard/page.tsx`** - ダッシュボードページ

### 画面構成

| セクション | 内容 | 遷移先 |
|---|---|---|
| **未処理件数カード** (3列) | 未仕訳取引 / 未消込入出金 / 按分未確定 | 各管理画面 |
| **アラート一覧** | 取引未申請 / 契約矛盾 / 残高アラート / 入金期限超過 | 各詳細ページ |
| **今月サマリー** | 売上 / 経費 / 入金 / 出金 / 未入金 | - |

### ビジネスロジック

- **未仕訳取引**: `status = awaiting_accounting/resubmitted` かつ仕訳なし
- **未消込入出金**: `Reconciliation` が紐づかない `BankTransaction`
- **按分未確定**: `AllocationTemplateLine` に対する `AllocationConfirmation` が不足しているトランザクション（raw query）
- **取引未申請**: 有効な `MasterContract` で当月取引がないもの
- **契約矛盾**: 契約終了日 < 取引開始日のもの
- **残高アラート**: 決済手段の残高（初期残高 + 入金 - 出金）が閾値以下
- **入金期限超過**: `paymentDueDate` を過ぎた未入金 `InvoiceGroup`
- **今月サマリー**: 当月の売上/経費（税込合計）、入出金合計、未入金請求合計
