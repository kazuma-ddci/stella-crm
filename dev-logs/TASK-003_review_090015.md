---

## TASK-003: 費目マスタ管理画面 レビュー結果

### 1. テーブル定義の整合性（設計書 ⑩ vs Prismaスキーマ vs 実装）

| フィールド | 設計書 | Prismaスキーマ | 実装 |
|---|---|---|---|
| id | Int @id @default(autoincrement()) | 一致 | hidden列として実装 |
| name | String | 一致 | CRUD + 重複チェック |
| type | String ("revenue"/"expense"/"both") | 一致 | CRUD + enum検証 |
| defaultAccountId | Int? FK→Account | 一致 | Account選択UI |
| displayOrder | Int @default(0) | 一致 | CRUD + reorder |
| isActive | Boolean @default(true) | 一致 | トグルUI |
| deletedAt | DateTime? | 一致 | クエリフィルタ |
| createdBy | Int? FK→MasterStaff | 一致 | create時に設定 |
| updatedBy | Int? FK→MasterStaff | 一致 | update時に設定 |

**全フィールド完全一致。**

### 2. 要望書との整合性

- **要望書 2.1.2**: 「費目マスタから選択。売上用と経費用に分かれる。マスタで管理し後から追加可能にする」 → type列のrevenueexpense/both + CrudTableで追加可能 **OK**
- **設計書 3.2.5**: 「費目マスタにデフォルト勘定科目を持たせることで、自動仕訳ルールの補助にもなる」 → defaultAccountId実装済み **OK**

### 3. バリデーション（設計書セクション6）

セクション6にExpenseCategory固有のバリデーション規定はないが、実装では適切なバリデーションが行われている:
- 名称必須チェック (actions.ts:21)
- 種別必須 + enum検証 (actions.ts:25-27)
- 名称重複チェック（deletedAt考慮）(actions.ts:30-36, 66-72)

### 4. 既存パターンとの整合性

勘定科目マスタ（accounts）と完全に同一のパターン:
- `Record<string, unknown>` 型定義
- `getSession()` 認証
- `throw new Error()` エラーハンドリング
- `$transaction` reorder
- `CrudTable` + `ColumnDef` + `SortableItem`
- `Card/CardHeader/CardTitle/CardContent` ページ構成

### 5. 追加の品質確認

- Account取得クエリで `isActive: true` フィルタ適用済み（非アクティブ科目は選択肢に出ない）
- Account無効化時のカスタムレンダラー対応（`（無効）`表示）
- `Promise.all` による並列クエリ実行
- 種別列に `filterable: true` で売上用/経費用フィルタ対応

---

```json
{
  "verdict": "OK",
  "issues": [],
  "summary": "TASK-003（費目マスタ管理画面）は設計書⑩のExpenseCategoryテーブル定義と完全に一致しており、要望書2.1.2・設計書3.2.5の要件を満たしている。Server Actions（create/update/reorder）のバリデーション・認証・エラーハンドリングは既存の勘定科目マスタパターンに忠実に従っている。名称重複チェック・deletedAtフィルタ・デフォルト勘定科目のカスタムレンダラー等、適切な実装が行われている。問題なし。"
}
```
