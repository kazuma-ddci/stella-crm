TASK-007 の実装が完了しました。TypeScriptコンパイルエラーもありません。

## 実装サマリー

### 作成ファイル（3ファイル）

| ファイル | 内容 |
|---|---|
| `src/app/stp/finance/transactions/actions.ts` | Server Actions: `listTransactions` + 型定義 (`TransactionListItem`, `TransactionFilters`, `TransactionSort`) |
| `src/app/stp/finance/transactions/page.tsx` | Server Component: データ取得 + サマリーカード + テーブル表示 |
| `src/app/stp/finance/transactions/transactions-table.tsx` | Client Component: フィルタ・ソート・ステータスタブ・テーブル |

### 実装内容

**Server Actions (`actions.ts`)**
- `listTransactions`: フィルタ（種別、ステータス、取引先、期間）とソートに対応
- Prismaの `Transaction` モデルから `counterparty`, `expenseCategory`, `costCenter`, `allocationTemplate`, `creator` をinclude
- `deletedAt: null` で論理削除されていないレコードのみ取得

**ページ (`page.tsx`)**
- サマリーカード4枚（売上合計・経費合計・未確認件数・差し戻し件数）
- 差し戻しがあるときだけ4列表示（既存パターン踏襲）
- 取引先の選択肢リストも並列取得

**テーブル (`transactions-table.tsx`)**
- **ステータスタブ**: すべて / 未確認 / 確認済み / 経理処理待ち / 差し戻し / 仕訳済み / 完了
- **フィルタ**: 種別（売上/経費）、取引先、期間（From〜To）
- **ソート**: 各カラムヘッダークリックで昇順/降順切り替え
- **ステータスバッジ**: 設計書のステータス9種（unconfirmed〜hidden）すべてに対応、色分け表示
- **種別バッジ**: 売上（緑系）/ 経費（赤系）
- **金額表示**: 税込合計 + 内訳（税抜+税率% or 内税率%）
- **期間表示**: 同日なら1日表示、異なればFrom〜To表示
- 日本語`localeCompare`回避（文字列は`<`/`>`比較、数値は引き算で比較）
