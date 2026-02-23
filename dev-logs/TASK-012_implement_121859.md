TASK-012の実装が完了しました。TypeScriptコンパイルエラーもありません。

## 実装サマリー

### 既に実装済みだったファイル（前回の attempt 1 で作成済み）

| ファイル | 内容 |
|---------|------|
| `src/lib/invoices/pdf-template.tsx` | InvoicePdfTemplate コンポーネント（@react-pdf/renderer + Noto Sans JP） |
| `src/lib/invoices/pdf-generator.ts` | PDF生成ヘルパー（データ取得 + バッファ生成） |
| `src/app/stp/finance/invoices/actions.ts` | `generateInvoicePdf` Server Action（採番 + PDF生成 + ファイル保存 + ステータス更新） |
| `src/app/stp/finance/invoices/invoice-group-detail-modal.tsx` | PDFプレビュー/保存/ダウンロード/再作成UI + PDF無効化警告 |
| `src/app/api/finance/invoice-groups/[id]/pdf/route.ts` | PDF API ルート（プレビュー/ダウンロード） |

### 今回の修正

| ファイル | 修正内容 |
|---------|---------|
| `src/app/api/finance/invoice-groups/[id]/pdf/route.ts` | **認証チェック追加** — `auth()` で未認証ユーザーのPDFアクセスをブロック |

### 仕様対応

- **設計書 8.1**: `@react-pdf/renderer` + Noto Sans JP でPDF生成。運営法人ロゴ・住所・登録番号、請求番号、明細テーブル、振込先口座、合計を表示
- **要望書 9.1**: `calcInvoiceTaxSummary` で税率グループごとに小計から一括計算（インボイス制度準拠）。明細ごとには税額計算しない
- **設計書 8.1 プレビュー**: API ルート（`?preview=true`）でオンザフライPDF生成 → iframe表示 → 確認 → 保存の2ステップフロー
- **要望書 2.3.5 + 設計書 6.8.1**: `updateInvoiceGroup`, `addTransactionToGroup`, `removeTransactionFromGroup` で `pdf_created` 時の変更検知 → PDF無効化（`pdfPath=null`, `status=draft`） + UI警告メッセージ表示
