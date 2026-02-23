全ファイルの確認が完了しました。レビュー結果をまとめます。

---

## TASK-025 レビュー結果（attempt 2）

### 前回レビュー（attempt 1）指摘事項の修正確認

| # | 重要度 | 指摘内容 | 修正状況 |
|---|--------|---------|---------|
| 1 | major | `createComment`で`commentType="return"` + `transactionId`の場合、Transaction.statusを更新しない二重経路問題 | **修正済み** — サーバー側ガード(`actions.ts:97-102`)とクライアント側フィルタ(`comment-section.tsx:300-303`)の両方で対応 |
| 2 | minor | `getComments`の3階層固定ネストに対するUIガードなし | **修正済み** — `depth < 2`で3階層目の返信ボタンを非表示(`comment-section.tsx:487`) |
| 3 | minor | `as unknown as CommentWithReplies[]`のunsafe型キャスト | **修正済み** — `Prisma.TransactionCommentGetPayload`と`pickCommentFields`ヘルパーで型安全に変換(`actions.ts:213-230`, `259-268`) |
| 4 | minor | アップロードAPIにファイル数上限なし | **修正済み** — `MAX_FILE_COUNT = 5`を追加(`route.ts:24`, `38-43`) |

### 仕様整合性チェック

**1. テーブル定義（設計書 ㉘ vs Prismaスキーマ）** — 一致

設計書のTransactionComment定義とPrismaスキーマ(`schema.prisma:3060-3084`)が完全一致。全カラム（`id`, `transactionId`, `invoiceGroupId`, `paymentGroupId`, `parentId`, `body`, `commentType`, `returnReasonType`, `createdBy`, `createdAt`, `deletedAt`）とリレーションが正確。

**2. 要望書3.5のフロー** — 準拠

- 差し戻し: `returnTransaction`がstatus遷移 + コメント作成をトランザクション内で実行 (`transactions/actions.ts:601-619`)
- 種別入力: `returnReasonType`の4種（question/correction_request/approval_check/other）を検証
- 再提出: `resubmitTransaction`が`returned`→`resubmitted`遷移 + 任意コメント作成 (`transactions/actions.ts:628-670`)
- 通知発行: 設計書5.8記載のNotification発行は未実装だが、通知機能はPhase 5（タスク21）で別対応のため問題なし

**3. 設計書6.7 ポリモーフィック排他制約** — 準拠

`validateEntityRef`関数（`actions.ts:58-75`）が`transactionId`/`invoiceGroupId`/`paymentGroupId`のいずれか1つのみnon-nullを検証。設計書の排他ルールに一致。

**4. コメント種別と差し戻し理由バリデーション** — 準拠

- `VALID_COMMENT_TYPES`: `["normal", "return", "approval", "question"]` — 設計書一致
- `VALID_RETURN_REASONS`: `["question", "correction_request", "approval_check", "other"]` — 要望書3.5.1一致
- `commentType === "return"`時の`returnReasonType`必須チェック — 設計書5.8一致

**5. スレッド表示** — 準拠

`parentId`による3階層ネスト取得 + UI側の`depth < 2`ガードで、データ取得とUI表示の整合性が確保されている。

**6. ファイル添付** — 準拠

`Attachment.commentId`でコメントに紐づけ（`actions.ts:153-163`）。設計書5.8「添付はAttachment.commentIdで紐付け」に一致。

### 今回のdiffの品質評価

- `satisfies Prisma.TransactionCommentInclude`による型チェックは堅牢
- `pickCommentFields`によるフィールド抽出で、Prisma内部型の漏洩を防止
- サーバー側 + クライアント側の二重ガードにより、差し戻しの二重経路問題を確実にブロック
- 既存コードパターン（Server Action、Prismaトランザクション、revalidatePath）に準拠

---

```json
{
  "verdict": "OK",
  "issues": [],
  "summary": "前回レビューで指摘した major 1件・minor 3件が全て適切に修正されている。差し戻しの二重経路問題はサーバー/クライアント両方でガード済み。型安全性も Prisma.TransactionCommentGetPayload を使った正しいアプローチに改善。設計書㉘のテーブル定義、要望書3.5のフロー、設計書5.8のコメント・差し戻しフロー、設計書6.7のポリモーフィック排他制約、全て仕様に準拠。"
}
```
