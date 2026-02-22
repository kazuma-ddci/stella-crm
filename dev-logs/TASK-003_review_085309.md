全情報が揃いました。レビューをまとめます。

---

## コードレビュー結果: TASK-003 費目マスタ管理画面

### 1. テーブル定義の整合性

**設計書 ⑩ ExpenseCategory** と **Prismaスキーマ** `prisma/schema.prisma:2539` を照合:

| カラム | 設計書 | Prisma | 実装 | 結果 |
|---|---|---|---|---|
| id | Int @id | Int @id | hidden column | OK |
| name | String | String | text, required | OK |
| type | "revenue"\|"expense"\|"both" | String | select, required | OK |
| defaultAccountId | Int? FK→Account | Int? | select (Account一覧) | OK |
| displayOrder | Int @default(0) | Int @default(0) | number, default 0 | OK |
| isActive | Boolean @default(true) | Boolean @default(true) | boolean, default true | OK |
| deletedAt | DateTime? | DateTime? | where filter | OK |
| createdBy/updatedBy | Int? | Int? | session.id で記録 | OK |

全カラム一致。

### 2. 要望書との整合性

- **要望書 2.1.2**: 「費目マスタから選択。売上用と経費用に分かれる。マスタで管理し後から追加可能にする」→ type フィールド (revenue/expense/both) で対応、CrudTable で追加可能 → OK
- **設計書 3.2.5**: 「費目マスタにデフォルト勘定科目を持たせる」→ defaultAccountId で対応 → OK
- **設計書 1.2 ページ構成**: `/accounting/masters/expense-categories` → パス一致 → OK

### 3. バリデーションルール (設計書セクション6)

ExpenseCategory マスタ固有のバリデーションルールは設計書セクション6に個別記載なし。汎用的なルール:
- 名称必須チェック → OK (`actions.ts:21`)
- 種別必須チェック + 有効値チェック → OK (`actions.ts:25-28`)
- 名称重複チェック (deletedAt: null 考慮) → OK (`actions.ts:31-35`)
- 更新時の自己除外重複チェック → OK (`actions.ts:67-72`)

### 4. ポリモーフィック排他制約 (設計書 6.7)

ExpenseCategory は 6.7 のポリモーフィック参照テーブル一覧に含まれないため対象外。

### 5. 既存コードパターンとの一致

勘定科目マスタ (`accounts/`) と完全に同じパターン:
- page.tsx: サーバーコンポーネント + Card レイアウト → 一致
- actions.ts: Server Action + getSession + バリデーション + revalidatePath → 一致
- テーブル: CrudTable + ColumnDef + sortableItems → 一致
- データ型変換: `String(id)` / `Number()` / `.trim()` → 一致

### 6. 細部の確認

| 観点 | 結果 |
|---|---|
| `deletedAt: null` フィルタ (page.tsx) | OK |
| Account選択肢に `isActive: true` フィルタ | OK |
| `Promise.all` で並列クエリ | OK |
| `$transaction` で並び替え一括更新 | OK |
| customRenderers で FK 表示 | OK |
| reorder アクション | OK |

### 発見事項

**Minor #1**: `page.tsx:10` — `include: { defaultAccount: { select: { id: true, code: true, name: true } } }` で取得した関連データが `data` マッピングで使用されていない。表示は `accountOptions` (別クエリ) の `customRenderers` で処理しているため、この `include` は不要な JOIN オーバーヘッド。

**Minor #2**: 非アクティブ化された勘定科目が `defaultAccountId` に設定されている費目の場合、`accountOptions` (`isActive: true` フィルタ) に含まれないため、テーブル表示が「（なし）」になる。Minor #1 の `include` データを活用すれば解消できる。ただし、勘定科目マスタ側にも同様のパターンがなく、エッジケースのため minor。

---

```json
{
  "verdict": "OK",
  "issues": [
    {
      "severity": "minor",
      "file": "src/app/accounting/masters/expense-categories/page.tsx",
      "description": "include: { defaultAccount: ... } で取得したリレーションデータが data マッピングで未使用。customRenderers は別クエリの accountOptions を使用しているため、不要な JOIN が発生している",
      "suggestion": "include を削除するか、あるいは include データを活用して非アクティブ勘定科目も正しく表示する（Minor #2 と合わせて対応）"
    },
    {
      "severity": "minor",
      "file": "src/app/accounting/masters/expense-categories/page.tsx",
      "description": "defaultAccountId に設定された勘定科目が非アクティブ化された場合、accountOptions (isActive: true) に含まれず、テーブル表示が「（なし）」になる",
      "suggestion": "defaultAccount の include データから名称を取得してフォールバック表示するか、accountOptions のクエリから isActive フィルタを外して非アクティブ科目も選択肢に含める（ラベルに「(無効)」を付与する等）"
    }
  ],
  "summary": "設計書・要望書に忠実な実装。Prismaスキーマとの整合性、バリデーション、既存パターン（勘定科目マスタ）との一貫性すべて問題なし。指摘は不要データ取得と非アクティブ勘定科目表示のエッジケースのみで、いずれも minor。"
}
```
