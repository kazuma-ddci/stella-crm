TASK-013の実装が完了しました。以下が実装内容のまとめです。

---

## 実装ファイル一覧

### 新規作成
1. **`src/lib/email/invoice-email.ts`** - メール送信ユーティリティ
   - `sendInvoiceEmail()` - nodemailerでPDF添付メール送信（法人SMTP/システム共通SMTP対応）
   - `expandTemplate()` - テンプレート変数(`{{法人名}}`, `{{取引先名}}`等)の展開

2. **`src/app/stp/finance/invoices/mail-actions.ts`** - Server Actions
   - `getInvoiceMailData()` - 送信フォーム初期化データ取得（担当者連絡先、送信元メール、テンプレート、送信履歴）
   - `sendInvoiceMail()` - メール送信（InvoiceMail/Recipient作成 → nodemailer送信 → 成功/失敗ステータス更新）
   - `resendInvoiceMail()` - 失敗メールの再送
   - `recordManualSend()` - LINE/郵送/その他の手動送付記録

3. **`src/app/stp/finance/invoices/invoice-mail-modal.tsx`** - UIモーダル
   - **メール送信タブ**: 送信元選択、宛先選択（担当者一覧+手動入力）、TO/CC/BCC設定、テンプレート自動生成、送信確認画面
   - **手動記録タブ**: LINE/郵送/その他の送付記録
   - **送信履歴タブ**: 過去の送信記録一覧、失敗メールの再送ボタン

### 変更
4. **`src/app/stp/finance/invoices/invoice-group-detail-modal.tsx`** - 既存モーダルに統合
   - `pdf_created`ステータス時に「送付」ボタンを追加（メール送付モーダルを開く）
   - InvoiceMailModalの組み込み

### 設計書との対応
| 設計書 | 実装 |
|---|---|
| ㉖ InvoiceMail | Prismaスキーマ既存 + mail-actions.ts |
| ㉗ InvoiceMailRecipient | Prismaスキーマ既存 + mail-actions.ts |
| 8.2 メール送信 | invoice-email.ts + invoice-mail-modal.tsx |
| 要望書 2.5.2 メール送信 | sendInvoiceMail + 確認画面 + 成功/失敗ハンドリング |
| 要望書 2.5.3 送付記録 | recordManualSend + 手動記録タブ |
