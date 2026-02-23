全5件の修正が完了し、`tsc --noEmit` もパスしました。

## 修正内容まとめ

| 指摘 | 修正内容 |
|------|---------|
| **P1** (Critical) | `expandTemplate` を `src/lib/email/template-utils.ts` に分離。クライアントコンポーネント (`invoice-mail-modal.tsx`) のimport先を変更。`invoice-email.ts` からは削除 |
| **P2** (Major) | `invoice-email.ts` の `sendMail` で `text: body`（プレーンテキスト）と `html: body.replace(/\n/g, "<br>")`（HTML変換）の両方を設定 |
| **P3** (Major) | `recordManualSend` / `sendInvoiceMail` / `resendInvoiceMail` の全3箇所で、InvoiceGroup.status を `sent` に更新するのは `group.status === "pdf_created"` の場合のみに制限。`awaiting_accounting`/`partially_paid`/`paid` の退行を防止 |
| **P4** (Minor) | `sendInvoiceMail` 冒頭でTO宛先が最低1件あるかバリデーションチェック追加 |
| **P5** (Minor) | InvoiceMail作成時に `paymentGroupId: null` を明示設定し、`invoiceGroupId` との排他制約を保証。`sendInvoiceMail` 冒頭で `invoiceGroupId` 必須チェックも追加 |
