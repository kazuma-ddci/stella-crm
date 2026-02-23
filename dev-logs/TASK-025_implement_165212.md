TASK-025: コメント・差し戻し機能の実装が完了しました。

## 実装サマリー

### 新規ファイル
| ファイル | 内容 |
|---|---|
| `src/app/accounting/comments/actions.ts` | Server Actions: `createComment`, `getComments` |
| `src/app/api/comments/upload/route.ts` | コメント添付ファイルのアップロードAPI |
| `src/app/accounting/comments/comment-section.tsx` | 再利用可能なコメントUIコンポーネント |

### 変更ファイル
| ファイル | 変更内容 |
|---|---|
| `src/app/accounting/transactions/[id]/edit/page.tsx` | 取引編集ページにコメントセクションを追加 |
| `src/app/stp/finance/invoices/invoice-group-detail-modal.tsx` | 「コメント」タブを追加 |
| `src/app/stp/finance/payment-groups/payment-group-detail-modal.tsx` | 「コメント」タブを追加 |

### 実装内容

**Server Actions (`createComment`)**
- 取引/請求グループ/支払グループへのコメント投稿（排他制約チェック付き）
- コメント種別: 通常・差し戻し・承認・質問
- 差し戻し時の理由種別: 質問・修正依頼・承認確認・その他
- `parentId`によるスレッド返信
- `Attachment.commentId`での添付ファイル紐付け

**Server Actions (`getComments`)**
- 3階層のネストされたスレッド構造を取得
- 論理削除(`deletedAt`)フィルタ適用

**CommentSection UIコンポーネント**
- スレッド表示（ネスト構造、インデント付き）
- コメント種別ごとのアイコン・色分け表示
- 差し戻し理由バッジ表示
- 返信モード切替
- ファイル添付（`/api/comments/upload`経由）
- 添付ファイルのダウンロードリンク

**既存のreturnTransaction/resubmitTransactionとの整合性**
- 既存の`returnTransaction`は差し戻しコメント(`commentType=return`)を自動作成済み → `getComments`でスレッドに表示される
- 既存の`resubmitTransaction`も任意コメント作成済み → 同様に表示される
