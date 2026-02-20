# SPEC-AUTH-001: 権限天井ロジック（スタッフ管理）

## メタ情報

| 項目 | 値 |
|------|-----|
| SPEC ID | SPEC-AUTH-001 |
| ステータス | ✅ confirmed |
| オーナー | - |
| 最終更新 | 2026-02-20 |
| 関連ファイル | `src/app/staff/actions.ts`, `src/app/staff/staff-table.tsx`, `src/app/staff/page.tsx`, `src/middleware.ts` |

## 背景（なぜこの仕様が必要か）

従来、スタッフ管理（`/staff`）は `stella` 権限（view+）がないとアクセスできなかった。しかし `stella` はシステム管理レベルの権限であり、各プロジェクトのスタッフが他のスタッフを追加したい場合に `stella` を付与するのは過剰。

また、権限付与は「admin のみ」というルールだったが、admin 権限を持たない edit ユーザーがスタッフ管理に関与できないという制限があった。

## 決定事項

### 1. commonプロジェクトの新設

- `MasterProject` に `common`（共通）を追加（displayOrder=1）
- 企業マスタ・スタッフ管理等の共通機能の権限を管理

### 2. スタッフ管理のアクセス条件変更

- **旧**: `stella` view+ が必要
- **新**: いずれかのプロジェクト（common含む）で `edit+` があれば許可

### 3. 権限天井ロジック

ユーザーが他のスタッフに設定できる権限レベルは、自分の権限レベル以下に制限される。

| ユーザーの権限 | 設定可能なレベル |
|--------------|----------------|
| Stella admin | 全プロジェクトで none/view/edit/admin |
| STP edit | STPのみ none/view/edit（admin不可） |
| STP admin | STPのみ none/view/edit/admin |
| Common edit + STP view | Commonのみ none/view/edit（STPは操作不可） |

### 4. サーバーサイドバリデーション

- `addStaff` / `updateStaff` で天井バリデーションを実行
- 送信された permissionLevel が自分の maxLevel を超えている場合、エラーをスロー

### 5. クライアント側の選択肢制限

- 各プロジェクト権限のセレクトボックスは、天井レベルに基づいて選択肢をフィルタ
- maxLevel="edit" → none/view/edit のみ表示
- maxLevel="admin" → none/view/edit/admin 全て表示

## 禁止事項（forbidden_changes）

- ❌ stella 権限の設定を stella admin 以外に許可してはならない
- ❌ 権限天井バリデーションをクライアント側のみで行ってはならない（サーバー側バリデーション必須）
- ❌ edit 権限のユーザーに admin 権限の付与を許可してはならない
- ❌ スタッフ管理のアクセスを stella 権限必須に戻してはならない

## 影響範囲

- `src/middleware.ts` — `/staff` のアクセス条件
- `src/components/layout/sidebar.tsx` — スタッフ管理メニューの表示条件
- `src/app/staff/actions.ts` — `getEditableProjects()`, 天井バリデーション
- `src/app/staff/page.tsx` — editableProjects の算出
- `src/app/staff/staff-table.tsx` — 権限選択肢の制限
- `prisma/migrations/20260220140000_add_common_project/` — DBマイグレーション
- `prisma/seed.ts` — common プロジェクト追加

## 検証方法

- 手動確認:
  1. 権限なしユーザーで `/staff` にアクセスできないことを確認
  2. STP edit ユーザーで `/staff` にアクセスし、STP 権限は edit 以下のみ設定可能であることを確認
  3. Stella admin で全プロジェクト admin まで設定可能であることを確認
  4. サイドバーのスタッフ管理メニューが適切に表示/非表示されることを確認

## ロールバック手順

この仕様を取り消す場合の手順：

1. マイグレーションを revert（common プロジェクトの DELETE）
2. `src/middleware.ts` で `/staff` を stella 必須に戻す
3. `src/components/layout/sidebar.tsx` で `requiredProject: "stella"` に戻す
4. `src/app/staff/actions.ts` で `getEditableProjectCodes()` に戻す
5. `src/app/staff/page.tsx` で `editableProjectCodes` に戻す
6. `src/app/staff/staff-table.tsx` で `editableProjectCodes` に戻す

## 変更履歴

| 日付 | 変更内容 | 承認者 |
|------|---------|--------|
| 2026-02-20 | 初版作成 | - |
