TASK-012 の実装が完了しました。TypeScriptコンパイルエラーもありません。

## 実装サマリー

### 新規作成ファイル

| ファイル | 内容 |
|---------|------|
| `src/lib/invoices/pdf-template.tsx` | InvoicePdfTemplate コンポーネント（@react-pdf/renderer + Noto Sans JP） |
| `src/lib/invoices/pdf-generator.ts` | PDF生成ヘルパー（データ取得 + バッファ生成） |
| `src/app/api/finance/invoice-groups/[id]/pdf/route.ts` | PDF API ルート（プレビュー/ダウンロード） |

### 変更ファイル

| ファイル | 変更内容 |
|---------|---------|
| `src/app/stp/finance/invoices/actions.ts` | `generateInvoicePdf` Server Action 追加、`InvoiceGroupListItem` に `pdfPath` 追加 |
| `src/app/stp/finance/invoices/invoice-group-detail-modal.tsx` | PDFプレビュー/保存/ダウンロード/再作成UI、PDF無効化警告を追加 |

### 仕様対応

- **要望書 2.5.1**: `@react-pdf/renderer` + Noto Sans JP でPDF生成。運営法人ロゴ・住所・登録番号、請求書番号、明細テーブル、振込先口座を表示
- **要望書 9.1**: 税額は明細ごとではなく、`calcInvoiceTaxSummary` で税率グループごとに小計から一括計算（インボイス制度準拠）
- **設計書 8.1**: BlobProvider相当のプレビュー → 確認 → 保存の2ステップフロー。保存先は `public/uploads/invoices/{year}/{month}/`
- **要望書 2.3.5**: PDF無効化ロジック（既存の `updateInvoiceGroup`, `addTransactionToGroup`, `removeTransactionFromGroup` に実装済み） + 警告UIを追加
