OperatingCompany には `deletedAt` カラムがないので、`deletedAt: null` フィルタは不要。Issue 7 は取り下げます。

---

## 最終レビュー結果

```json
{
  "verdict": "OK",
  "issues": [
    {
      "severity": "minor",
      "file": "src/app/stp/finance/payment-groups/actions.ts",
      "description": "requestInvoice アクションが未使用のデッドコード。UIからは sendPaymentGroupMail が直接呼ばれ、ステータス遷移もそちらで処理されている。requestInvoice は画面のどこからも呼ばれていない。",
      "suggestion": "将来的にメール送信なしのステータス変更が必要なければ削除を検討。使う予定がある場合はコメントで用途を明記する。"
    },
    {
      "severity": "minor",
      "file": "src/app/stp/finance/payment-groups/payment-group-detail-modal.tsx",
      "description": "confirmReceivedInvoice に expectedPaymentDate 更新パラメータがあるが、UI側の handleConfirm は空オブジェクトで呼んでおり、確認時に支払予定日を更新するUIが未実装。設計書 6.9.1 の「確認画面: 必要に応じて expectedPaymentDate を更新可能」に対応する入力フィールドがない。",
      "suggestion": "handleConfirm 内で expectedPaymentDate の入力ダイアログを表示するか、invoice_received ステータスの基本情報タブで expectedPaymentDate が編集可能になるよう isEditable 条件を拡張する。"
    },
    {
      "severity": "minor",
      "file": "src/app/stp/finance/payment-groups/mail-actions.ts",
      "description": "sendPaymentGroupMail の送信可能ステータスに requested と re_requested が含まれている。設計書上は明確に定義されていないが、再送用途として合理的ではある。",
      "suggestion": "コメントで「requested/re_requested 時は再送メール用途」と明記する。"
    }
  ],
  "summary": "TASK-015の実装は設計書・要望書に概ね忠実で品質が高い。Prismaスキーマとの完全一致、ステータス遷移の正確な実装、ポリモーフィック排他制約の適切な処理、3ステップ作成ウィザードのUX、メール送信・再送・送信履歴の包括的な実装など、仕様を網羅的にカバーしている。指摘は全てminorレベル（未使用コード、確認画面のUI不足、コメント不足）であり、致命的な問題はない。"
}
```
