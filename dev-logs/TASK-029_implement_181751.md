全ての指摘事項を修正しました。`npx tsc --noEmit` もエラーなしで通過しています。

## 修正サマリー

| 指摘 | 重要度 | 修正内容 |
|------|--------|----------|
| **P1: ロゴアップロードAPIに認証なし** | Critical | `auth()` による認証チェック + `canEditMasterDataSync` による権限チェックを追加（401/403レスポンス） |
| **P2: SMTPパスワードがクライアントに漏洩** | Critical | `smtpPass` の代わりに `hasSmtpPass: boolean` をクライアントに送信。page.tsx / email-actions.ts（add/update両方のレスポンス）/ emails-modal.tsx（CompanyEmail型）を修正。更新時はパスワードが入力された場合のみ上書き |
| **P3: ファイル拡張子未検証** | Major | `ALLOWED_EXTENSIONS` ホワイトリストを追加し、MIMEタイプと拡張子の両方を検証。ファイル名生成も検証済みの `ext` を使用するよう修正 |
| **未使用import** | Minor | `useRef`, `useCallback` のインポートを削除 |
