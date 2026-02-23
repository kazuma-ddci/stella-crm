TASK-031の実装が完了しました。以下が実装内容のまとめです。

## 実装サマリー

### 変更・作成ファイル

**1. `src/app/accounting/masters/counterparties/actions.ts`（変更）**
- `recordChangeLog` のimport追加
- `detectDuplicates()`: 全取引先を正規化名で比較し重複候補ペアを検出（完全一致 + 部分包含の2段階）
- `getCounterpartyMergeImpact()`: 統合前の影響範囲を確認（Transaction, RecurringTransaction, BankTransaction, AutoJournalRule, InvoiceGroup, PaymentGroup の各件数 + 重複ルール警告）
- `mergeCounterparties()`: トランザクション内でFK付替え（6テーブル）→ 統合元に `mergedIntoId`, `mergedAt`, `deletedAt` を設定 → ChangeLog記録

**2. `src/app/accounting/masters/counterparties/duplicates/page.tsx`（新規）**
- サーバーコンポーネント。`detectDuplicates()` で候補を取得してクライアントに渡す

**3. `src/app/accounting/masters/counterparties/duplicates/duplicates-check.tsx`（新規）**
- 重複候補ペア一覧テーブル（名称, 種別, CRM企業を両方表示）
- 「統合する」ボタン → 影響範囲確認ダイアログ（件数表示 + 重複ルール警告）→ 統合実行
- 「別物」ボタン → セッション内で候補を除外
- 「再チェック」ボタン → 重複検出を再実行
- 統合方向の切替機能

### 設計書との対応
| 設計書5.7の要件 | 実装 |
|---|---|
| 類似名称チェック（正規化比較） | `detectDuplicates()` — 正規化名の完全一致・部分包含 |
| 定期重複チェック画面 | `/accounting/masters/counterparties/duplicates` ページ |
| 統合前の影響範囲確認 | `getCounterpartyMergeImpact()` + 確認ダイアログ |
| 統合実行（FK付替え + 論理削除 + ChangeLog） | `mergeCounterparties()` — $transaction内で一括処理 |
| 重複ルール警告 | AutoJournalRule の重複チェック + Alert表示 |
