TASK-022: 按分確定フローの実装が完了しました。以下が実装内容のサマリーです。

---

## 実装サマリー

### 新規ファイル

**`src/app/accounting/transactions/allocation-actions.ts`** — Server Actions
- `calculateAllocatedAmounts()` — PL計算用の按分金額動的計算。端数処理（1円未満切り捨て、差額は最後の按分先に寄せる）を実装
- `getAllocationStatus()` — 取引の按分確定状況を取得。オーバーライド対応、確定/未確定ステータス、金額計算を含む
- `confirmAllocation()` — 按分確定。AllocationConfirmationレコード作成 + 全プロジェクト確定時の自動ステータス遷移
- `autoConfirmCreatorAllocations()` — 取引作成時に、作成者プロジェクトのコストセンターを自動確定

**`src/app/accounting/transactions/allocation-confirmation-panel.tsx`** — UIコンポーネント
- `AllocationConfirmationPanel` — 按分確定モーダル。各コストセンターの確定状況・按分金額を表示し、未確定項目を確定するボタンを提供
- `AllocationStatusButton` — 取引テーブルの操作列用の「按分」ボタン

### 修正ファイル

**`src/app/accounting/transactions/actions.ts`**
- `createTransaction()` に自動按分確定ロジックを追加（テンプレート使用時に作成者プロジェクトを自動確定）
- `confirmTransaction()` に全プロジェクト確定チェックを追加（全確定なら自動で `awaiting_accounting` に遷移）
- `getTransactions()` に `allocationTemplate` を含めるように拡張

**`src/app/accounting/transactions/transactions-table.tsx`**
- `TransactionRow` 型に `allocationTemplate` を追加
- 操作列に `AllocationStatusButton` を追加（按分テンプレートがある取引に「按分」ボタンを表示）

### 設計書との対応

| 仕様 | 実装 |
|---|---|
| 自動確定（作成者プロジェクト） | `autoConfirmCreatorAllocations` in `createTransaction` |
| 他プロジェクトへの通知 | ダッシュボードの未確定件数表示（既存） |
| 確認・確定画面 | `AllocationConfirmationPanel` モーダル |
| 全プロジェクト確定後の経理引き渡し | `checkAndTransitionToAwaitingAccounting` + `confirmTransaction` 内の自動遷移 |
| PL計算での按分金額の動的計算 | `calculateAllocatedAmounts` |
| 端数処理（1円未満切り捨て、最後に寄せる） | `calculateAllocatedAmounts` 内の `Math.floor` + remainder ロジック |
