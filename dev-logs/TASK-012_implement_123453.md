TASK-012は前回のattempt 2で既に完全に実装済みです。TypeScriptコンパイルエラーもありません。

## 実装済みファイル一覧と設計書との対応

| 設計書要件 | 実装ファイル | 状態 |
|---|---|---|
| InvoicePdfTemplate (`@react-pdf/renderer` + Noto Sans JP) | `src/lib/invoices/pdf-template.tsx` | 完了 |
| 運営法人ロゴ、請求番号、明細、振込先、合計の表示 | 同上 | 完了 |
| 税額は小計から一括計算（要望書 9.1） | `src/lib/finance/invoice-tax.ts` | 完了 |
| PDFデータ取得・バッファ生成 | `src/lib/invoices/pdf-generator.ts` | 完了 |
| PDFプレビュー機能 | `src/app/api/finance/invoice-groups/[id]/pdf/route.ts` (`?preview=true`) | 完了 |
| PDF保存 (`public/uploads/invoices/{year}/{month}/{fileName}`) | `src/app/stp/finance/invoices/actions.ts` の `generateInvoicePdf` | 完了 |
| PDF無効化ロジック（明細変更時: 要望書 2.3.5） | `actions.ts` の `updateInvoiceGroup`, `addTransactionToGroup`, `removeTransactionFromGroup` | 完了 |
| UI: プレビューダイアログ + 無効化警告 | `src/app/stp/finance/invoices/invoice-group-detail-modal.tsx` | 完了 |

### 主要なビジネスロジック

- **PDF生成フロー**: プレビュー(API経由) → 確認 → 保存(Server Action: 採番+ファイル保存+ステータス更新)
- **税額計算**: 税率グループ別に小計を集計 → `Math.floor`で端数切捨て（インボイス制度準拠）
- **PDF無効化**: `pdf_created`状態で明細変更時 → `pdfPath=null`, `pdfFileName=null`, `status="draft"` に戻す
- **警告表示**: `status === "draft" && invoiceNumber && !pdfPath` の条件で「PDFが無効になりました」を表示
