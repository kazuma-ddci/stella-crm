全ての情報を収集しました。レビュー結果をまとめます。

---

## レビュー結果: TASK-002 勘定科目マスタ管理画面

### 1. テーブル定義の一致確認

| カラム | 設計書⑬ | Prisma | 実装 | 結果 |
|--------|---------|--------|------|------|
| id | Int @id @default(autoincrement()) | 一致 | hidden: true | OK |
| code | String @unique | 一致 | text, required, editableOnCreate/Update | OK |
| name | String | 一致 | text, required | OK |
| category | String "asset"\|"liability"\|"revenue"\|"expense" | 一致 | select, 4選択肢 | OK |
| displayOrder | Int @default(0) | 一致 | number, defaultValue: 0 | OK |
| isActive | Boolean @default(true) | 一致 | boolean, defaultValue: true | OK |
| createdBy | Int? | 一致 | createAccount で設定 | OK |
| updatedBy | Int? | 一致 | updateAccount で設定 | OK |
| createdAt/updatedAt | DateTime | 一致 | Prisma自動管理 | OK |

### 2. 要望書3.6との整合性

要望書3.6:
- 科目コード、科目名、科目区分（資産/負債/収益/費用）、表示順、有効フラグ → **全項目実装済み**
- 経理管理者が管理 → 権限管理は要望書10章で「後日対応」と明記。現状は問題なし

### 3. バリデーション実装

| ルール | 実装状況 |
|--------|---------|
| 科目コード必須 | `actions.ts:17` OK |
| 科目名必須 | `actions.ts:17` OK |
| 区分必須 | `actions.ts:17` OK |
| 科目コード重複チェック（新規） | `actions.ts:22-28` findUnique OK |
| 科目コード重複チェック（更新、自分除外） | `actions.ts:55-61` findFirst + id除外 OK |
| createdBy/updatedBy記録 | `actions.ts:37,83` OK |

### 4. 既存パターンとの整合性

- CrudTable使用 → プロジェクト標準パターンに準拠
- Server Actions + revalidatePath → 標準パターン
- getSession()でセッション取得 → 標準パターン
- ソート対応（sortableItems + reorderAccounts）→ 他画面と同等
- $transaction使用 → 一括更新の安全性確保

### 5. 検出した問題

**Issue 1 (minor)**: `category` のサーバーサイドバリデーション不足

`createAccount`/`updateAccount` で `category` が "asset" | "liability" | "revenue" | "expense" のいずれかであることを検証していません。UIのselectで制限されていますが、Server Actionsは技術的にPOSTリクエストで直接呼び出し可能なため、不正な値の登録を防げません。

**Issue 2 (minor)**: サイドバーの配置がフラット

設計書のページ構成では `/accounting/masters/` 配下にマスタページ群がネストされていますが、サイドバーでは「経理」セクション直下にフラットに配置されています。今後マスタページが増えた際にサブグループ化が必要ですが、現時点では1ページのみなので許容範囲です。

---

```json
{
  "verdict": "OK",
  "issues": [
    {
      "severity": "minor",
      "file": "src/app/accounting/masters/accounts/actions.ts",
      "description": "createAccount/updateAccountでcategoryの値バリデーションが不足。\"asset\"|\"liability\"|\"revenue\"|\"expense\"以外の不正値が登録される可能性がある",
      "suggestion": "const VALID_CATEGORIES = [\"asset\", \"liability\", \"revenue\", \"expense\"];\nif (!VALID_CATEGORIES.includes(category)) throw new Error(\"無効な区分です\"); を追加"
    },
    {
      "severity": "minor",
      "file": "src/components/layout/sidebar.tsx",
      "description": "勘定科目が「経理」セクション直下にフラット配置されている。設計書では/accounting/masters/配下のサブグループとして設計されている",
      "suggestion": "今後マスタページが増える際に「マスタ管理」サブグループにまとめる。現時点では1ページのみのため許容"
    }
  ],
  "summary": "設計書⑬ Accountテーブル定義と完全一致。要望書3.6の全項目（科目コード、科目名、区分、表示順、有効フラグ）が実装済み。科目コード重複チェック、createdBy/updatedBy記録、CrudTableパターンの使用など、品質は良好。categoryのサーバーサイドバリデーション不足とサイドバー配置のminor issue 2件のみで、verdict: OK"
}
```
