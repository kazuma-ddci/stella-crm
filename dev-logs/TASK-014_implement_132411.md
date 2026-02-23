全3件の指摘を修正完了しました。`npx tsc --noEmit` もパスしています。

## 修正内容まとめ

### 1. [MAJOR] 名称重複チェック順序の修正 — `actions.ts`
- `operatingCompanyId` → `templateType` → `name` の順に最終値を確定してから、3フィールドのいずれかが変更された場合にまとめて重複チェックを実行するように変更
- これにより、法人や種別を同時に変更した場合でも新しい組み合わせで正しく重複検出できるようになった

### 2. [MINOR] null 変換による TypeError リスク修正
- **クライアント側** (`invoice-templates-table.tsx:84`): `onChange(e.target.value || null)` → `onChange(e.target.value)` に変更し、null 送信を防止
- **サーバー側** (`actions.ts`): `(data.xxx as string).trim()` → `((data.xxx as string) ?? "").trim()` に変更し、万が一 null が来ても TypeError にならないよう防御（create/update 両方）

### 3. [MINOR] isDefault 排他制御のトランザクション化 — `actions.ts`
- `createInvoiceTemplate`: `updateMany`（既存デフォルト解除）+ `create` を `prisma.$transaction([...])` でラップ
- `updateInvoiceTemplate`: `updateMany`（既存デフォルト解除）+ `update` を `prisma.$transaction([...])` でラップ
- レースコンディションで複数のデフォルトが同時設定されるリスクを解消
