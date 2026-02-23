全修正が完了しました。以下が修正内容のまとめです。

---

## 修正サマリー

### Major Issue 1: 月フィルタが機能していない
**問題**: 予実比較タブの月セレクターが存在するが、`getBudgetVsActual`に月パラメータが渡されておらず、フィルタリングが全く機能していなかった。

**修正内容**:
- `page.tsx`: `searchParams`に`month`を追加し、パースして`getBudgetVsActual`と`BudgetPageClient`に渡す
- `budget-page-client.tsx`: `handleMonthChange`で月変更時にURLパラメータを更新→サーバーサイドで再フェッチ

### Major Issue 2: accountId=null の予算で実績が常に0
**問題**: `getBudgetVsActual`で`accountId`がnullの予算は実績が常に0になり、予実比較が無意味だった。設計書では「accountIdがない場合はcategoryLabelで管理」と記載。

**修正内容**:
- `actions.ts`: 勘定科目名別の実績集計マップ(`actualByAccountName`)を追加
- `accountId`がある場合はIDで直接マッチ、ない場合は`categoryLabel`で`Account.name`とマッチング

### Major Issue 3: 定期取引自動生成の差分レビュー表示が未実装
**問題**: 設計書に「既存Budgetがある月は上書きせず差分レビュー表示」と記載があるが、確認ダイアログ→即時生成→toast表示のみで、何が作成され何がスキップされるか事前確認できなかった。

**修正内容**:
- `actions.ts`: `previewBudgetFromRecurring`アクションを追加（作成/スキップ一覧を返す）
- `budget-input-table.tsx`: ボタンクリック→プレビュー取得→差分レビューダイアログ（テーブル形式で新規/スキップを表示）→確認後に生成実行

### コンパイルチェック
- `npx tsc --noEmit`: **エラー0件**
