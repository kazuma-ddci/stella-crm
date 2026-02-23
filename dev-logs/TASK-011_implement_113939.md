TASK-011の実装が完了しました。以下が実装内容のサマリーです。

## 実装完了: TASK-011 請求グループ管理画面

### 作成・変更したファイル

| ファイル | 内容 |
|---------|------|
| `src/lib/finance/invoice-number.ts` | `generateInvoiceGroupNumber()` を追加。法人別採番 `{abbreviation}-INV-{YYYYMM}-{NNNN}` 形式。トランザクション内排他制御対応 |
| `src/app/stp/finance/invoices/actions.ts` | 旧StpInvoice版から新InvoiceGroup版に全面置換。Server Actions: `createInvoiceGroup`, `updateInvoiceGroup`, `addTransactionToGroup`, `removeTransactionFromGroup`, `deleteInvoiceGroup`, `createCorrectionInvoiceGroup`, `assignInvoiceNumber`, `updateInvoiceGroupStatus`, `recalcInvoiceGroupTotals` |
| `src/app/stp/finance/invoices/page.tsx` | InvoiceGroup一覧ページ。サマリーカード（総件数/下書き/請求合計/未入金）+ テーブル |
| `src/app/stp/finance/invoices/invoice-groups-table.tsx` | 一覧テーブル。ステータスタブ、取引先フィルタ、ソート、新規作成/詳細モーダル連携 |
| `src/app/stp/finance/invoices/create-invoice-group-modal.tsx` | 3ステップ作成フロー: 取引先選択 → 確認済み取引選択 → 請求情報設定（要望書2.3.1準拠） |
| `src/app/stp/finance/invoices/invoice-group-detail-modal.tsx` | 詳細モーダル: 基本情報編集、明細一覧、取引追加/削除、ステータス操作、訂正請求書作成 |
| `src/app/api/finance/invoice-groups/[id]/transactions/route.ts` | グループ内取引取得API |

### 実装内容の詳細

- **請求書番号自動採番**: 設計書8.7準拠。`{略称}-INV-{年月}-{連番}` フォーマット。`StpInvoiceNumberSequence`テーブルの`operatingCompanyId`で法人別管理
- **ステータス制限**: 要望書2.3.4準拠。draft/pdf_created→編集可、sent以降→編集不可（訂正のみ）
- **訂正請求書**: 差し替え（replacement）/追加請求（additional）の2種類。元請求書は「訂正済み」ステータスに
- **金額自動計算**: 取引追加・削除時に小計/税額/合計を自動再計算
- **PDF無効化**: pdf_created状態で明細変更時にPDFパスをクリアし、draftに戻す
- **`npx tsc --noEmit` エラーなし**
