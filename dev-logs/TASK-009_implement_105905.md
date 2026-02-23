TASK-009 の実装が完了しました。以下に実装内容をまとめます。

---

## TASK-009: 取引ステータス管理 実装完了

### 1. Server Actions（`src/app/accounting/transactions/actions.ts`）

**ステータス遷移定義** (`VALID_STATUS_TRANSITIONS`)
- `unconfirmed` → `confirmed`
- `confirmed` → `awaiting_accounting`, `returned`
- `awaiting_accounting` → `journalized`, `returned`
- `returned` → `resubmitted`
- `resubmitted` → `awaiting_accounting`
- `journalized` → `partially_paid`, `paid`
- `partially_paid` → `paid`
- `paid` → `hidden`

**新規 Server Actions:**
| Action | 遷移 | 説明 |
|---|---|---|
| `confirmTransaction(id)` | unconfirmed → confirmed | 確認者・確認日時を記録 |
| `returnTransaction(id, {body, returnReasonType})` | confirmed/awaiting_accounting → returned | コメント+理由種別を `TransactionComment` に記録 |
| `resubmitTransaction(id, body?)` | returned → resubmitted | 任意コメント付き再提出 |
| `hideTransaction(id)` | paid → hidden | `deletedAt` も設定（論理削除） |
| `getTransactions(filters?)` | - | ステータス・プロジェクト等でフィルタ可能な一覧取得 |
| `isMonthClosed(targetMonth, projectId)` | - | 月次クローズ状態チェック |

**月次クローズチェック** (`checkMonthlyClose`)
- 取引の `periodFrom`〜`periodTo` に含まれる全月を `AccountingMonthlyClose` テーブルでチェック
- `project_closed` or `accounting_closed` の月が含まれる場合はエラー
- `confirmTransaction`, `returnTransaction`, `resubmitTransaction`, `hideTransaction`, `updateTransaction` 全てに適用

**updateTransaction への追加ガード**
- 編集可能なステータスは `unconfirmed` と `returned` のみ
- 月次クローズチェックも追加

### 2. UI コンポーネント

| ファイル | 種別 | 説明 |
|---|---|---|
| `transaction-status-badge.tsx` | Server Component | 9種のステータスに対応したカラーバッジ |
| `transaction-status-actions.tsx` | Client Component | 確認/差し戻し/再提出/非表示の各ボタン＋確認ダイアログ |
| `transactions-table.tsx` | Client Component | ステータスバッジ＋アクションボタン付き取引一覧テーブル |

**ステータス別表示ボタン:**
- `unconfirmed`: 編集リンク + 確認ボタン（AlertDialog）
- `confirmed` / `awaiting_accounting`: 差し戻しボタン（Dialog: 理由種別 + コメント必須）
- `returned`: 編集リンク + 再提出ボタン（Dialog: コメント任意）
- `paid`: 非表示ボタン（AlertDialog）

### 3. ページ更新（`page.tsx`）
- `Transaction` モデルの一覧（ステータス管理付き）を追加
- 既存の `AccountingTransaction`（入出金データ）テーブルも残存
- 新規取引作成ボタンを追加

### TypeScript コンパイルエラー: なし
