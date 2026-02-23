全4件の修正が完了し、コンパイルエラーもありません。修正内容をまとめます。

---

## 修正サマリー

| # | 重要度 | 指摘内容 | 修正内容 |
|---|--------|----------|----------|
| 1 | Major | 他プロジェクトへの通知が未実装、TODOもなし | `autoConfirmCreatorAllocations` の末尾にTODOコメント追加（通知基盤作成後に按分確定依頼通知を送信する旨） |
| 2 | Major | `confirmTransaction` と `checkAndTransitionToAwaitingAccounting` で全確定チェックロジックが重複 | `checkAndTransitionToAwaitingAccounting` を `export` 化し、`confirmTransaction` 内の重複コード（約28行）を `await checkAndTransitionToAwaitingAccounting(id)` の1行に置き換え |
| 3 | Minor | `confirmAllocation` でステータス事前チェック不足 | `unconfirmed` / `confirmed` 以外のステータスではエラーを投げるチェックを追加 |
| 4 | Minor | 経理処理待ち状態のフィードバック不足 | `awaiting_accounting` → 「経理処理待ちに移行済みです。」、`journalized` → 「仕訳済みです。」のメッセージを追加 |
