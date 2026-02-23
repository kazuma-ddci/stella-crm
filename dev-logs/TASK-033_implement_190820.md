TASK-033 の実装が完了しました。以下が変更内容のまとめです。

## 実施内容

### リダイレクト設定（6ファイル）
| 旧パス | リダイレクト先 |
|---|---|
| `/stp/finance/` | `/stp/finance/overview/` |
| `/stp/finance/revenue/` | `/stp/finance/transactions/` |
| `/stp/finance/expenses/` | `/stp/finance/transactions/` |
| `/stp/finance/company-summary/` | `/stp/finance/overview/` |
| `/stp/finance/company-summary/[companyId]/` | `/stp/finance/overview/` |
| `/accounting/` | `/accounting/dashboard/` |

### 新規作成
- `src/app/stp/finance/overview/page.tsx` - ダッシュボードを旧 `/stp/finance/page.tsx` から移動。内部リンクも `/stp/finance/revenue` → `/stp/finance/transactions` 等に更新済み

### サイドバー更新 (`sidebar.tsx`)
- 「ダッシュボード」 `/stp/finance` → `/stp/finance/overview`
- 「売上管理」「経費管理」「企業別サマリー」を削除し、「取引管理」 `/stp/finance/transactions` に統合
- 「ダッシュボード」 `/accounting` → `/accounting/dashboard`

### 参照先更新
- `contract-history-actions.ts`: revalidatePath を `/stp/finance/transactions` と `/stp/finance/overview` に変更
- `agent-contract-history-actions.ts`: 同上（2箇所）
- `payments/actions.ts`: 同上（2箇所）
- `stp-companies-table.tsx`: 収支サマリーリンクを `/stp/finance/overview` に変更

### 旧コンポーネント削除（4ファイル）
- `revenue/revenue-table.tsx` - 参照なし確認済み
- `revenue/actions.ts` - 参照なし確認済み
- `expenses/expenses-table.tsx` - 参照なし確認済み
- `expenses/actions.ts` - 参照なし確認済み

### 保持したファイル
- `FinanceSummaryTable` (`src/components/finance-summary-table.tsx`) - `agent-summary/[agentId]/page.tsx` でまだ使用中
