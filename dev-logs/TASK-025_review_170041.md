# TASK-025 レビュー結果

- レビュー日時: 2026-02-23
- コミット: d9d2c77 feat(TASK-025): 実装 (attempt 1)
- verdict: **NG**

## Issues

### [major] CommentSectionのcommentType="return"がTransaction.status遷移を伴わない
- **ファイル**: src/app/accounting/comments/actions.ts
- **問題**: CommentSectionからcommentType='return'のコメントを作成できるが、Transaction.statusを'returned'に更新しない。設計書5.8では差し戻し時にstatus更新が必須。returnTransaction（transactions/actions.ts）と二重の差し戻し経路が存在し、片方だけstatus遷移するデータ不整合リスク
- **修正案**: createCommentでcommentType='return' + transactionIdの場合はエラーを返す（差し戻しはreturnTransaction経由に限定）。または、CommentSectionの取引コメントではreturnを選択肢から除外する

### [minor] getCommentsのスレッドネスト深さが3階層固定
- **ファイル**: src/app/accounting/comments/actions.ts
- **問題**: 4階層以上の返信が表示されない
- **修正案**: depth >= 3の場合は返信ボタンを非表示にするUIガードを追加

### [minor] getCommentsの型キャスト
- **ファイル**: src/app/accounting/comments/actions.ts:245
- **問題**: as unknown as CommentWithReplies[] のunsafe型キャスト
- **修正案**: Prisma.TransactionCommentGetPayload型を使用

### [minor] アップロードAPIにファイル数上限なし
- **ファイル**: src/app/api/comments/upload/route.ts
- **問題**: 一度にアップロードできるファイル数に制限がない
- **修正案**: MAX_FILE_COUNT = 5 等の上限を追加
