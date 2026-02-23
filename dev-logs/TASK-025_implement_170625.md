全ての修正が完了しました。以下が修正内容のまとめです。

---

## 修正サマリー

### 1. [major] CommentSection の commentType="return" がTransaction.status遷移を伴わない問題
**対象ファイル**: `src/app/accounting/comments/actions.ts`, `src/app/accounting/comments/comment-section.tsx`

- **サーバー側**: `createComment` で `commentType='return'` かつ `transactionId` が指定された場合にエラーを返すバリデーションを追加。差し戻しは `returnTransaction` 経由に限定
- **UI側**: 取引コメントフォームの種別セレクトから「差し戻し」選択肢を除外（`transactionId` がある場合は `return` をフィルタ）

### 2. [minor] スレッドネスト深さの制限
**対象ファイル**: `src/app/accounting/comments/comment-section.tsx`

- `depth < 2` の場合のみ返信ボタンを表示するUIガードを追加。`getComments` が3階層（depth 0, 1, 2）までしか取得しないため、depth=2 以降では返信を作成できないようにした

### 3. [minor] getComments の unsafe 型キャスト解消
**対象ファイル**: `src/app/accounting/comments/actions.ts`

- `Prisma` をインポートし、`commentBaseInclude` / `commentThreadInclude` を `satisfies Prisma.TransactionCommentInclude` で定義
- `Prisma.TransactionCommentGetPayload` を使って `CommentBase` 型を定義
- `pickCommentFields` ヘルパー関数で共通フィールドを抽出し、型安全なマッピングで `CommentWithReplies[]` を構築
- `as unknown as CommentWithReplies[]` を完全に除去

### 4. [minor] アップロードAPIにファイル数上限を追加
**対象ファイル**: `src/app/api/comments/upload/route.ts`

- `MAX_FILE_COUNT = 5` を追加し、ファイル数超過時に400エラーを返すバリデーションを実装
