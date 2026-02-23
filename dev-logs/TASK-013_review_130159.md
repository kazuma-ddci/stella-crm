全ファイルの確認が完了しました。レビュー結果をまとめます。

---

## TASK-013 レビュー結果（attempt 2）

### 対象コミット
- `622cc0a feat(TASK-013): 実装 (attempt 2)`

### 前回レビュー（attempt 1）指摘の修正確認

| 指摘 | 修正状況 | 確認結果 |
|------|---------|---------|
| **P1** Critical: クライアントから`invoice-email.ts`(nodemailer含む)をimport | `expandTemplate`を`template-utils.ts`に分離、import先変更 | OK |
| **P2** Major: `html: body`でプレーンテキストをそのまま送信 | `text: body` + `html: body.replace(/\n/g, "<br>")` に修正 | OK |
| **P3** Major: ステータス退行（sent/paid → sent） | 3箇所全て `group.status === "pdf_created"` の場合のみ更新 | OK |
| **P4** Minor: TO宛先のサーバーサイドバリデーション欠如 | `sendInvoiceMail`冒頭にチェック追加 | OK |
| **P5** Minor: 排他制約（6.7）の明示 | `paymentGroupId: null`を3箇所に明示設定 | OK |

### 仕様準拠チェック

**1. テーブル定義 (Prismaスキーマ vs 設計書 ㉖㉗)**
- InvoiceMail: 全カラム・リレーション一致
- InvoiceMailRecipient: 全カラム・リレーション一致

**2. ステータス遷移 (設計書 6.8, 8.2.1)**
- メール送信成功: InvoiceMail→sent, InvoiceGroup→sent（pdf_createdの場合のみ）— 仕様通り
- メール送信失敗: InvoiceMail→failed, InvoiceGroup変更なし — 仕様通り
- 手動送付記録: InvoiceMail→sent, InvoiceGroup→sent（pdf_createdの場合のみ）— 仕様通り
- 再送: 既存InvoiceMailを更新（新規作成しない）— 設計書8.2.1「既存InvoiceMailを更新して再送」に準拠

**3. バリデーション (設計書 6.7)**
- InvoiceMailのinvoiceGroupId/paymentGroupId排他制約: `paymentGroupId: null`の明示設定で保証

**4. 要望書 2.5.2/2.5.3 準拠**
- 送信先: StellaCompanyContactから選択 + 手動入力 — 実装済み
- TO/CC/BCC設定 — 実装済み
- テンプレートから件名・本文自動生成 — 実装済み
- 送信確認画面 — 実装済み
- 送信成功/失敗のハンドリング — 実装済み
- メール以外の送付記録（LINE/郵送/その他）— 実装済み

**5. コード品質**
- `recordManualSend`のトランザクション: 配列形式からコールバック形式に修正され、`tx`を正しく使用
- エラーハンドリング: try/catch + InvoiceMail.status=failed + errorMessage記録の3段構え
- 型安全性: 問題なし

---

```json
{
  "verdict": "OK",
  "issues": [],
  "summary": "前回レビュー(attempt 1)で検出された5件の指摘（Critical×1, Major×2, Minor×2）が全て適切に修正されている。expandTemplateのモジュール分離、HTML/テキスト両方のメール送信、3箇所のステータス退行防止、TO宛先バリデーション、排他制約の明示設定いずれも仕様通り。テーブル定義・ステータス遷移・バリデーションルール全て設計書に準拠しており、新たな問題は検出されなかった。"
}
```
