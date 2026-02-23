TypeScriptコンパイルエラーなしで全て完了しました。

## 実装内容まとめ

### 作成ファイル（4ファイル）

| ファイル | 説明 |
|---|---|
| `src/app/accounting/journal/actions.ts` | Server Actions |
| `src/app/accounting/journal/page.tsx` | 仕訳一覧ページ |
| `src/app/accounting/journal/journal-table.tsx` | 仕訳テーブルコンポーネント |
| `src/app/accounting/journal/journal-status-badge.tsx` | ステータスバッジ |
| `src/app/accounting/journal/journal-entry-modal.tsx` | 仕訳作成・編集モーダル |

### Server Actions（`actions.ts`）

- **`getJournalEntries`** - 仕訳一覧取得（ステータス・日付フィルタ対応）
- **`createJournalEntry`** - 新規仕訳作成（手動仕訳）。排他FK制約バリデーション、借方/貸方合計一致チェック、勘定科目存在チェック、紐づき先存在チェック
- **`updateJournalEntry`** - 下書き仕訳の更新（明細は全削除→再作成）
- **`confirmJournalEntry`** - 仕訳確定（draft→confirmed）。確定時に借方/貸方合計を再検証、紐づいた取引のステータスを「仕訳済み」に更新
- **`deleteJournalEntry`** - 下書き仕訳の論理削除
- **`getJournalFormData`** - フォーム用マスタデータ取得（勘定科目一覧）

### UI機能

- **仕訳一覧**: 日付、摘要、借方/貸方科目、金額、紐づき先（請求G/支払G/取引/手動）、ステータス、作成者/確定者を表示
- **フィルタ**: テキスト検索（摘要・科目・取引先名）、ステータスフィルタ
- **新規仕訳モーダル**: 仕訳日・摘要のヘッダー情報、借方/貸方ごとの明細行（勘定科目・金額・明細摘要）、行の動的追加/削除、リアルタイムの借方/貸方合計表示と差額警告
- **設計書6.2準拠**: debit合計 = credit合計のバリデーション（UI・Server両方で実施）
- **確定フロー**: AlertDialogで確認→`confirmJournalEntry`実行→取引ステータス連動更新
- **削除**: 下書きのみ削除可能（AlertDialogで確認）
