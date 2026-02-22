全ての情報が揃いました。レビュー結果をまとめます。

---

## レビュー結果: TASK-002 勘定科目マスタ管理画面

### コミット: `bae24b7 feat(TASK-002): 実装 (attempt 2)`

前回レビューで指摘された2つのminor issueへの修正コミット。修正内容を検証し、全体の実装品質も確認します。

---

### 1. テーブル定義の一致確認

| カラム | 設計書⑬ | Prisma (L2628-2649) | 実装 | 結果 |
|--------|---------|--------|------|------|
| id | Int @id @default(autoincrement()) | 一致 | hidden: true | OK |
| code | String @unique | 一致 | text, required, editableOnCreate/Update, 重複チェック | OK |
| name | String | 一致 | text, required | OK |
| category | String "asset"\|"liability"\|"revenue"\|"expense" | 一致 | select(4値), required, **サーバーバリデーション追加済** | OK |
| displayOrder | Int @default(0) | 一致 | number, defaultValue: 0 | OK |
| isActive | Boolean @default(true) | 一致 | boolean, defaultValue: true | OK |
| createdBy | Int? → MasterStaff | 一致 | createAccountでstaffId設定 | OK |
| updatedBy | Int? → MasterStaff | 一致 | updateAccountでstaffId設定 | OK |
| createdAt/updatedAt | DateTime | 一致 | Prisma自動管理 | OK |

### 2. 要望書3.6との整合性

要望書3.6の要件:
- 科目コード → `actions.ts:11` ✅
- 科目名 → `actions.ts:12` ✅
- 科目区分（資産/負債/収益/費用） → `accounts-table.tsx:7-12` CATEGORY_OPTIONS 4値 ✅
- 表示順 → `accounts-table.tsx:46-49` + `reorderAccounts` ✅
- 有効フラグ → `accounts-table.tsx:52-55` ✅
- 経理管理者が管理 → 権限管理は要望書10章で「後日対応」のため現段階では問題なし ✅

### 3. バリデーションルール (設計書 Section 6)

設計書6.xにAccount固有のバリデーションルールは明示されていない。一般的なバリデーションとして:

| ルール | 実装箇所 | 結果 |
|--------|---------|------|
| code必須 | `actions.ts:17` | OK |
| name必須 | `actions.ts:17` | OK |
| category必須 | `actions.ts:17` | OK |
| category値バリデーション | `actions.ts:21-24` (create), `actions.ts:78-81` (update) | OK (**本コミットで修正**) |
| code重複チェック(新規) | `actions.ts:27-33` findUnique | OK |
| code重複チェック(更新、自分除外) | `actions.ts:60-66` findFirst + id除外 | OK |

### 4. ポリモーフィック排他制約 (設計書 6.7)

Account は6.7の対象テーブルに含まれていない → 該当なし ✅

### 5. 前回レビュー指摘の修正確認

| 指摘 | 修正内容 | 結果 |
|------|---------|------|
| Issue 1: category サーバーバリデーション不足 | `VALID_CATEGORIES`リストで検証追加 (create: L21-24, update: L78-81) | 修正完了 ✅ |
| Issue 2: サイドバーフラット配置 | 「マスタ管理」サブグループにネスト (`sidebar.tsx:171-177`) | 修正完了 ✅ |

### 6. 既存パターンとの整合性

- CrudTable使用 → プロジェクト標準 ✅
- Server Actions + revalidatePath → 標準 ✅
- getSession() → createAccount, updateAccount で使用 ✅
- SortableItem + reorderAccounts + $transaction → 他画面と同等 ✅

### 7. 検出した問題

**Issue 1 (minor)**: `reorderAccounts` で `getSession()` 未呼び出し・`updatedBy` 未記録

`actions.ts:103-114` の `reorderAccounts` は `getSession()` を呼んでおらず、`displayOrder` 変更時に `updatedBy` が更新されません。要望書2.1.6では「全てのテーブルに作成者・更新者を記録する」とされており、並び替え操作の監査証跡が残りません。`createAccount`/`updateAccount` はいずれも `getSession()` で `updatedBy` を設定しているため、一貫性が欠けています。

**Issue 2 (minor)**: `VALID_CATEGORIES` 定数の重複定義

`actions.ts:21` と `actions.ts:78` で同じ `VALID_CATEGORIES` 配列がそれぞれの関数内で定義されています。モジュールレベルの定数に抽出すべきです。

---

```json
{
  "verdict": "OK",
  "issues": [
    {
      "severity": "minor",
      "file": "src/app/accounting/masters/accounts/actions.ts",
      "description": "reorderAccounts でgetSession()を呼ばず、updatedBy も記録していない。要望書2.1.6の「全テーブルに更新者を記録」の原則に反し、createAccount/updateAccount との一貫性も欠ける",
      "suggestion": "reorderAccounts の先頭に const session = await getSession(); を追加し、各 prisma.account.update の data に updatedBy: session.id を含める"
    },
    {
      "severity": "minor",
      "file": "src/app/accounting/masters/accounts/actions.ts",
      "description": "VALID_CATEGORIES が createAccount(L21) と updateAccount(L78) の2箇所で重複定義されている",
      "suggestion": "ファイル先頭でモジュールレベル定数として const VALID_CATEGORIES = ['asset', 'liability', 'revenue', 'expense'] as const; を1回だけ定義する"
    }
  ],
  "summary": "前回レビューの2件のminor指摘（categoryバリデーション不足、サイドバーフラット配置）は適切に修正済み。設計書⑬ Accountテーブル定義とPrismaスキーマは完全一致。要望書3.6の全項目（科目コード、科目名、区分、表示順、有効フラグ）が網羅されている。新たに検出した問題はreorderAccountsの認証・監査証跡欠如とVALID_CATEGORIES重複定義の2件（いずれもminor）。verdict: OK"
}
```
