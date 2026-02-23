TASK-015: 支払グループ管理ページの実装が完了しました。

## 作成ファイル一覧（7ファイル）

| ファイル | 内容 |
|---------|------|
| `actions.ts` | Server Actions（CRUD、ステータス遷移、取引追加/削除） |
| `mail-actions.ts` | メール関連 Server Actions（データ取得、送信、再送） |
| `page.tsx` | サーバーコンポーネント（一覧ページ、サマリーカード） |
| `payment-groups-table.tsx` | クライアントコンポーネント（タブ、フィルタ、ソート） |
| `create-payment-group-modal.tsx` | 新規作成ウィザード（3ステップ） |
| `payment-group-detail-modal.tsx` | 詳細モーダル（ステータス別アクション） |
| `payment-group-mail-modal.tsx` | メール送信モーダル（テンプレート、履歴） |

## 実装済み機能

- **ステータス遷移**: `before_request → requested → invoice_received → confirmed → paid`（却下分岐: `rejected → re_requested → invoice_received`）
- **新規作成フロー**: 取引先選択 → 経費取引選択 → 支払情報入力の3ステップウィザード
- **請求書発行依頼メール**: テンプレート(`templateType: "request"`)対応、PDF添付なし
- **請求書受領・確認**: 受領日記録、確認フロー
- **却下・再依頼**: 却下理由の記録（`TransactionComment`）、再依頼メール送信
- **TypeScriptコンパイル**: `npx tsc --noEmit` エラー0件で通過
