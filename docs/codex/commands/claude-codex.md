# /claude-codex コマンド

以下の手順を実行してください:

## 手順

1. `docs/claude-codex/codex-plan.md` を読み込む（元ネタ・要件定義）
2. 読み込んだ内容をベースに、現在のコードベースの状態（Prismaスキーマ、既存実装ファイル等）を精査する
3. 実装計画（plan）を作成する
   - 現状の実装状況を反映
   - 各Phaseの具体的な実装項目・ファイルパス・受け入れ条件を含む
   - 横断タスク（型チェック、マイグレーション等）も記載
   - 主要ファイルパスと検証方法を含む
4. 作成したプランを `docs/claude-codex/claude-plan.md` に上書き保存する

## 注意

- 入力: `codex-plan.md`（読み込み専用・書き換えない）
- 出力: `claude-plan.md`（プランの上書き保存先）
- コードベースの現状を必ず確認してからプランを作成すること
- 実装は行わない（プラン作成のみ）
- `prisma db push` は禁止（`prisma migrate dev --name <変更内容>` を使う）
- マイグレーション後は `npx prisma generate` + `docker compose restart app` が必須
- STPスコープのサーバー検証は最優先で維持する
