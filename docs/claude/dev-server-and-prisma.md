# 開発サーバー運用 & Prisma マイグレーション手順

## 開発サーバー

- **ローカルで `npx next dev` を絶対に実行しない。** DATABASE_URLが`db:5432`（Dockerコンテナ内ホスト名）を指しているため、ローカルからはDB接続できない
- 開発サーバーは必ず **Dockerコンテナ内** で起動する: `docker compose up app -d`
- サーバーが停止している場合は `docker compose up app -d` で起動する
- サーバーの再起動が必要な場合は `docker compose restart app` を使う
- `.env` の `DATABASE_URL` を勝手に変更しない

## Prisma マイグレーション手順

スキーマ変更時は以下の **全ステップ** を必ず実行すること。1つでも抜けると `Unknown field` や `column does not exist` エラーが発生する。

### 手順

```bash
# 1. マイグレーション適用（Docker内のDBに反映）
docker compose exec app npx prisma migrate deploy

# 2. ローカルの Prisma Client を再生成（TypeScriptの型に反映）
npx prisma generate

# 3. Docker内の Prisma Client を再生成（実行時のDBアクセスに反映）
docker compose exec app npx prisma generate

# 4. 開発サーバーを再起動（Turbopackの古いモジュールキャッシュをクリア）
docker compose restart app
```

### なぜ全ステップが必要か

| ステップ | 抜けた場合のエラー |
|---------|-------------------|
| `migrate deploy` | DB にカラム/テーブルが存在しない |
| ローカル `prisma generate` | TypeScript の型エラー（`tsc --noEmit` で検出） |
| Docker内 `prisma generate` | **実行時エラー**: `Unknown field`, `column does not exist` |
| `docker compose restart app` | Turbopackが古いPrisma Clientをキャッシュしたまま動く |

### よくあるミス

- ❌ ローカルの `prisma generate` だけ実行してDocker内を忘れる → 実行時エラー
- ❌ Docker内の `prisma generate` だけ実行してサーバー再起動を忘れる → キャッシュで古いまま
- ❌ `prisma db push` を使う → マイグレーションファイルが生成されず `migrate reset` が壊れる（**使用禁止**）

### マイグレーション作成時

Docker内でインタラクティブな `prisma migrate dev` が使えない場合は、手動でマイグレーションを作成する：

```bash
# 1. ディレクトリ作成（タイムスタンプ_説明）
mkdir -p prisma/migrations/YYYYMMDDHHMMSS_description/

# 2. migration.sql を手書き
# 3. 上記の適用手順を実行
```
