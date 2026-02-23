TASK-028の実装が完了しました。以下が実装内容のサマリーです。

---

## 実装サマリー

### 1. コアロジック（`src/lib/finance/monthly-close.ts`）
- `MonthlyCloseLog` モデルベースに全面書き換え
- `isMonthClosed()` - 最新ログの `action` で判定（`projectId = null` の全社クローズ）
- `closeMonth()` - クローズイベント記録（PLスナップショット付き）
- `reopenMonth()` - 再オープンイベント記録（理由必須）
- `ensureMonthNotClosed()` - 編集禁止ガード関数

### 2. 経理側ページ（`/accounting/monthly-close`）
- **`actions.ts`** - `getMonthlyCloseData()`: 月別ステータス＋PL集計（確定仕訳ベース）、`closeMonthAction()`: PLスナップショット自動生成＋クローズ、`reopenMonthAction()`: 再オープン
- **`monthly-close-client.tsx`** - クローズ/再オープン操作UI（確認ダイアログ、理由入力ダイアログ）
- **`page.tsx`** - サマリーカード + 月別ステータス表 + 操作ボタン + 履歴一覧

### 3. プロジェクト側ページ（`/stp/finance/monthly-close`）
- **閲覧のみ**に変更（クローズ/再オープンボタン削除）
- `MonthlyCloseLog` ベースの状況表示 + 履歴一覧
- STP売上・経費レコードからPL集計表示

### 4. クローズ済み月の編集禁止チェック
以下の全アクションに `ensureMonthNotClosed` を追加:
- **取引**: `createTransaction`, `updateTransaction` + ステータス変更4箇所
- **仕訳**: `createJournalEntry`, `updateJournalEntry`, `confirmJournalEntry`, `deleteJournalEntry`
- **入出金**: `createBankTransaction`, `updateBankTransaction`, `deleteBankTransaction`
- **消込**: `createReconciliation`, `cancelReconciliation`（`checkMonthlyCloseForReconciliation` を簡潔化）
- **STP**: 売上・経費の既存チェック（変更なし、既に `ensureMonthNotClosed` を呼び出し済み）

### 5. TypeScriptコンパイル
- `npx tsc --noEmit` エラーなし
