# TASK-013 レビュー結果

## 対象コミット
- `2e921ae feat(TASK-013): 実装 (attempt 1)`

## 判定: NG

## 検出された問題

### P1 (Critical): クライアントからサーバー専用モジュールimport
- **ファイル**: `src/app/stp/finance/invoices/invoice-mail-modal.tsx:28`
- **問題**: `expandTemplate` を `@/lib/email/invoice-email.ts` からimport。同ファイルはトップレベルで `nodemailer`, `fs`, `path` をimportしており、クライアントバンドルでビルドエラーになる
- **修正**: `expandTemplate` を `src/lib/email/template-utils.ts` に分離

### P2 (Major): メール本文のHTML送信問題
- **ファイル**: `src/lib/email/invoice-email.ts:119`
- **問題**: `html: body` でプレーンテキストを送信。改行がHTMLで無視され、確認画面と実際のメール表示が異なる
- **修正**: `body.replace(/\n/g, '<br>')` でHTML変換、またはプレーンテキストメールとして送信

### P3 (Major): recordManualSendのステータス退行
- **ファイル**: `src/app/stp/finance/invoices/mail-actions.ts`
- **問題**: `recordManualSend` が `awaiting_accounting`/`partially_paid`/`paid` ステータスを `sent` に退行させる
- **修正**: `group.status === "pdf_created"` の場合のみステータス更新

### P4 (Minor): TO宛先のサーバーサイドバリデーション欠如
- **ファイル**: `src/app/stp/finance/invoices/mail-actions.ts`
- **修正**: `sendInvoiceMail` 冒頭でTO宛先チェックを追加

### P5 (Minor): 排他制約バリデーション未実装
- **ファイル**: `src/app/stp/finance/invoices/mail-actions.ts`
- **修正**: InvoiceMail作成時に `invoiceGroupId`/`paymentGroupId` 排他制約チェック追加
