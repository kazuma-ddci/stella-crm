全6件の指摘を修正しました。`npx tsc --noEmit` もエラーなしで通っています。

## 修正サマリー

### Major（3件）

| # | ファイル | 修正内容 |
|---|---------|---------|
| 1 | `api/finance/invoice-groups/[id]/transactions/route.ts` | `auth()` による認証チェックを追加。未認証時は401を返す |
| 2 | `stp/finance/invoices/actions.ts` `removeTransactionFromGroup` | `where` に `invoiceGroupId: groupId` を追加し、別グループの取引を誤解除しないよう検証 |
| 3 | `stp/finance/invoices/actions.ts` `updateInvoiceGroup` | PDF無効化条件から `&& group.pdfPath` を削除し、`addTransaction`/`removeTransaction` と統一 |

### Minor（3件）

| # | ファイル | 修正内容 |
|---|---------|---------|
| 1 | `stp/finance/invoices/actions.ts` `updateInvoiceGroup` | ステータスブロックリストに `returned` を追加 |
| 2 | `stp/finance/invoices/page.tsx` | 直接Prismaクエリを削除し、`getInvoiceGroups()` を呼ぶ形に統一。未使用の `sentCount` と `bankAccounts` クエリも除去 |
| 3 | `stp/finance/invoices/actions.ts` `createCorrectionInvoiceGroup` | forループの個別 `update` を `updateMany` による一括更新に変更 |
