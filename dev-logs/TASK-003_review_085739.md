全ての情報が揃いました。レビューをまとめます。

---

## コードレビュー結果: TASK-003 費目マスタ管理画面（attempt 2）

### コミット概要

- **HEAD** (`516aef0`): `feat(TASK-003): 実装 (attempt 2)` — 前回レビューの Minor #1, #2 を修正
- **HEAD~1** (`96d307c`): `feat(TASK-003): 実装 (attempt 1)` — 初回実装（3ファイル新規作成）

attempt 2 の差分は `page.tsx` と `expense-categories-table.tsx` の2箇所のみ。

---

### 1. テーブル定義の整合性（設計書 ⑩ vs Prisma vs 実装）

| カラム | 設計書 | Prisma `schema.prisma:2539` | 実装 | 結果 |
|---|---|---|---|---|
| id | Int @id | Int @id | hidden column | OK |
| name | String | String | text, required, filterable | OK |
| type | "revenue"\|"expense"\|"both" | String | select(3値), required, filterable | OK |
| defaultAccountId | Int? FK→Account | Int? | select (Account一覧 + fallback) | OK |
| displayOrder | Int @default(0) | Int @default(0) | number, default 0 | OK |
| isActive | Boolean @default(true) | Boolean @default(true) | boolean, default true | OK |
| deletedAt | DateTime? | DateTime? | where { deletedAt: null } | OK |
| createdBy | Int? | Int? | session.id で記録 | OK |
| updatedBy | Int? | Int? | session.id で記録 | OK |

**全カラム完全一致。**

---

### 2. 要望書・設計書との整合性

| 仕様 | 参照箇所 | 実装 | 結果 |
|---|---|---|---|
| 費目マスタ管理、売上用・経費用に分かれる | 要望書 2.1.2 | type: revenue/expense/both | OK |
| 売上用・経費用のフィルタ | タスク要件 | `filterable: true` on type column | OK |
| デフォルト勘定科目を持たせる | 設計書 3.2.5 | defaultAccountId + Account選択 | OK |
| ページパス | 設計書 1.2 | `/accounting/masters/expense-categories` | OK |
| 新規作成・編集 | タスク要件 | `createExpenseCategory`, `updateExpenseCategory` | OK |
| Accountテーブルからデフォルト勘定科目選択 | タスク要件 | `prisma.account.findMany({ isActive: true })` | OK |

---

### 3. バリデーションルール（設計書セクション6）

ExpenseCategoryマスタ固有のルールはセクション6に個別記載なし。汎用バリデーション:

| チェック | 箇所 | 結果 |
|---|---|---|
| 名称必須 | `actions.ts:21` | OK |
| 種別必須 + 有効値 | `actions.ts:25-27` | OK |
| 名称重複チェック (deletedAt: null考慮) | `actions.ts:30-36` | OK |
| 更新時の自己除外重複チェック | `actions.ts:66-72` | OK |
| 種別更新時の有効値チェック | `actions.ts:77-80` | OK |

---

### 4. ポリモーフィック排他制約（設計書 6.7）

ExpenseCategoryは6.7の対象テーブル一覧に含まれないため **対象外**。

---

### 5. 既存コードパターンとの一致

勘定科目マスタ (`accounts/`) と完全に同一パターン:

| 観点 | 結果 |
|---|---|
| page.tsx: サーバーコンポーネント + Card | OK |
| actions.ts: Server Action + getSession + revalidatePath | OK |
| CrudTable + ColumnDef + SortableItem | OK |
| Promise.all 並列クエリ | OK |
| $transaction 一括並び替え | OK |
| データ型変換 (`String(id)`, `Number()`, `.trim()`) | OK |

---

### 6. attempt 2 修正内容の評価

**page.tsx:24-26** — `include`で取得済みの`defaultAccount`データを`defaultAccountLabel`としてdataに追加。不要JOINが有効活用されるようになった。**修正適切。**

**expense-categories-table.tsx:66-71** — customRendererのフォールバックロジック:
1. `accountOptions`（アクティブ科目）から検索
2. 見つからない場合 → `item.defaultAccountLabel` + `（無効）`表示
3. どちらもない場合 → `（なし）`

非アクティブ化された勘定科目でも正しいラベルが表示される。**修正適切。**

---

```json
{
  "verdict": "OK",
  "issues": [],
  "summary": "設計書・要望書に完全に忠実な実装。Prismaスキーマとの全カラム一致、バリデーション（必須チェック・有効値チェック・重複チェック）、既存パターン（勘定科目マスタ）との一貫性すべて問題なし。attempt 1 のレビューで指摘した Minor 2件（不要JOINと非アクティブ勘定科目表示）も attempt 2 で適切に修正済み。指摘事項なし。"
}
```
