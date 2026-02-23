全ての情報が揃いました。diff、仕様書、設計書、Prismaスキーマ、既存パターンを照合してレビューを行います。

---

## TASK-006 コードレビュー: コストセンター（按分先）マスタ管理画面

### 1. テーブル定義とPrismaスキーマの整合性

| 設計書カラム | Prismaスキーマ | 実装 | 結果 |
|---|---|---|---|
| id (Int, PK) | `@id @default(autoincrement())` | 使用 (hidden column) | OK |
| name (String) | `String` | 必須チェック+重複チェック | OK |
| projectId (Int?) | `Int?` FK→MasterProject | 存在チェック+null許容 | OK |
| isActive (Boolean) | `@default(true)` | デフォルトtrue処理あり | OK |
| createdBy (Int?) | FK→MasterStaff | session.idをセット | OK |
| updatedBy (Int?) | FK→MasterStaff | session.idをセット | OK |
| createdAt (DateTime) | `@default(now())` | Prisma自動管理 | OK |
| updatedAt (DateTime) | `@updatedAt` | Prisma自動管理 | OK |
| deletedAt (DateTime?) | `DateTime?` | `where: { deletedAt: null }` フィルタ | OK |

設計書⑤のCostCenterテーブル定義とPrismaスキーマは**完全一致**。実装も全カラムを正しく扱っています。

### 2. 要望書 2.6.1 との整合性

| 要望 | 実装状況 |
|---|---|
| CRM外プロジェクト（社内開発、管理部門等）も按分先にできる | name のみで作成可能（projectId任意） OK |
| CRMプロジェクトとの紐づけ | projectId でMasterProjectと関連付け OK |
| 按分先マスタからの選択に使用 | マスタ管理画面として一覧・作成・編集を実装 OK |

### 3. 設計書セクション6 バリデーションルール

- **名称重複チェック**: `deletedAt: null` 条件付きで実装済み（作成・更新両方） OK
- **projectId存在チェック**: `masterProject.findUnique` で確認済み（作成・更新両方） OK
- **論理削除対応**: ページの一覧取得で `deletedAt: null` フィルタ適用済み OK

### 4. 既存コードパターンとの整合性

| 項目 | 既存パターン (Accounts等) | 本実装 | 判定 |
|---|---|---|---|
| Server Action構造 | `"use server"`, getSession, revalidatePath | 同一 | OK |
| 引数型 | `Record<string, unknown>` | 同一 | OK |
| 部分更新 | `"key" in data` で条件分岐 | 同一 | OK |
| ページ構造 | async, Card/CardHeader/CardContent | 同一 | OK |
| テーブルコンポーネント | CrudTable + ColumnDef | 同一 | OK |
| データ並列取得 | Promise.all | 適用済み | OK |

### 5. TypeScript型安全性・エラーハンドリング

- `getSession()` でセッション取得、staffId設定 OK
- `Number(data.projectId)` による型変換 OK（空文字はfalsyでnullに）
- `throw new Error()` でバリデーションエラーを返却 OK
- `customRenderers` で無効化プロジェクトのフォールバック表示あり OK

### 6. 特記事項

- **MasterProject選択肢**: `isActive: true` でフィルタし、`displayOrder` 順で取得。適切。
- **プロジェクトラベル表示**: `code - name` 形式で統一。紐づきプロジェクトが無効化された場合の「（無効）」表示も実装済み。
- **CrudTable連携**: `onAdd`/`onUpdate` に正しく Server Actions を渡している。

---

```json
{
  "verdict": "OK",
  "issues": [],
  "summary": "TASK-006 コストセンター（按分先）マスタ管理画面は、設計書⑤のCostCenterテーブル定義・要望書2.6.1の要件を忠実に実装しています。actions.ts（createCostCenter, updateCostCenter）は名称重複チェック・projectId存在チェック・論理削除対応・createdBy/updatedBy自動設定を正しく実装。page.tsxはPromise.allによる並列データ取得、deletedAt:nullフィルタ、Card UIレイアウトで既存マスタ画面パターンと完全に一致。cost-centers-table.tsxはCrudTableコンポーネントを活用し、プロジェクト選択ドロップダウンとcustomRenderersによる表示制御も適切です。critical/majorの問題はありません。"
}
```
