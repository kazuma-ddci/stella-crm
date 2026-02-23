全ての情報が揃いました。レビュー結果をまとめます。

---

## TASK-014 レビュー: 請求書テンプレート管理画面（attempt 2）

### 変更概要

前回レビュー（attempt 1）で検出された3件の指摘に対する修正コミット。

### 前回指摘の修正確認

**1. [MAJOR] 名称重複チェック順序の修正** — 修正OK

`actions.ts:107-157`: 全フィールドの最終値を先に確定（`operatingCompanyId` → `templateType` → `name`）してから、いずれかが変更された場合にまとめて重複チェックを実行するように変更。法人や種別を同時に変更した場合でも、新しい組み合わせで正しく重複検出できるようになった。

**2. [MINOR] null変換によるTypeErrorリスク修正** — 修正OK

- クライアント側（`invoice-templates-table.tsx:84`）: `onChange(e.target.value || null)` → `onChange(e.target.value)` でnull送信を防止
- サーバー側（`actions.ts`全箇所）: `(data.xxx as string).trim()` → `((data.xxx as string) ?? "").trim()` で防御的nullハンドリングを追加

**3. [MINOR] isDefault排他制御のトランザクション化** — 修正OK

- `createInvoiceTemplate`（L52-74）: `$transaction([updateMany, create])` でラップ
- `updateInvoiceTemplate`（L180-202）: `$transaction([updateMany, update])` でラップ
- レースコンディションによる複数デフォルト同時設定リスクを解消

### 再チェック結果

| チェック観点 | 結果 |
|---|---|
| 1. テーブル定義とPrismaスキーマの整合性 | OK — 設計書 ㉕ と `prisma/schema.prisma:2974-2993` が完全一致 |
| 2. 要望書フロー | OK — 要望書 4.2 の全要件（法人別複数テンプレ、送付用/発行依頼用、テンプレート変数8種）をカバー |
| 3. バリデーションルール | OK — 前回の順序問題が修正済み |
| 4. ポリモーフィック排他制約（6.7） | 該当なし（InvoiceTemplateに排他FK制約なし） |
| 5. TypeScript型安全性・エラーハンドリング | OK — null安全性が追加済み |
| 6. 既存コードパターン | OK — CrudTable/getSession/論理削除/revalidatePath準拠 |

### 新たに検出した問題

なし。修正は適切で、新たな問題を導入していません。

`createInvoiceTemplate` 内の `create` データブロックがif/elseで重複している点はスタイル上の冗長性ですが、可読性を損なわず、バグの原因にもならないため指摘対象外とします。

---

```json
{
  "verdict": "OK",
  "issues": [],
  "summary": "前回レビューで検出された3件（major×1、minor×2）が全て適切に修正されている。名称重複チェックの処理順序修正、null安全性の追加、isDefault排他制御のトランザクション化、いずれも正しく実装されており、新たな問題は検出されなかった。設計書・要望書との整合性、既存コードパターンへの準拠も良好。"
}
```
