# セットアップ状況チェックの更新

新しいマスターデータテーブルを追加したり、既存機能が新しいマスターデータに依存するようになった場合、**`src/app/admin/setup-status/actions.ts` の `checkDefinitions` 配列にチェック項目を追加すること。**

これにより、本番環境で「何のデータが不足しているか」が `/admin/setup-status` ページに自動表示される。

## 追加が必要なケース

- 新しいマスターデータテーブルを作成した（例: 新しいPrismaモデル）
- 既存テーブルが新しいプロジェクトで使われるようになった（例: SRD用の顧客種別）
- 新機能が特定のデータの存在を前提としている（例: 新しい設定画面）

## 追加方法

`checkDefinitions` 配列に以下の形式で追加:

```typescript
{
  id: "unique-id",           // ユニークなID
  category: "共通",          // "共通" | "STP" | "経理" | 新カテゴリ
  name: "表示名",
  description: "説明文",
  required: 1,               // 最低必要件数（0=推奨、1以上=必須）
  href: "/settings/xxx",     // 設定画面へのパス
  countFn: () =>             // 現在の件数を返す関数
    prisma.xxx.count({ where: { isActive: true } }),
},
```

## 注意

- `required: 0` は「あると望ましい（推奨）」、`required: 1以上` は「ないと機能が動かない（必須）」
- プロジェクト別のデータは `countFn` 内で `masterProject.findUnique({ where: { code: "xxx" } })` でプロジェクトIDを取得してフィルタする
