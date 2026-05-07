# /plan-up コマンド

Codexのレビューを反映して実装プランを更新する。
このコマンドは何度でも繰り返し実行される想定。毎回必ず最新の `plan-review.md` を読み直すこと。

## 手順

1. **必ず** `docs/claude-codex/plan-review.md` を Read ツールで読み込む（キャッシュではなく毎回ファイルから読む）
2. `docs/claude-codex/claude-plan.md` を Read ツールで読み込む
3. `plan-review.md` の指摘事項・修正案・フィードバックを元に `claude-plan.md` を更新する
   - P1（必須修正）は必ず反映
   - P2（推奨）も可能な限り反映
   - P3（任意）は判断して反映
4. 更新した内容を `docs/claude-codex/claude-plan.md` に上書き保存する
5. 更新内容のサマリーを表示する（何を変更したか）

## 実装開始の判断

`plan-review.md` の「実装判定」セクションを確認する:

- **「実装して良い」「実装OK」等の実装許可がある場合**:
  - プランの最終更新・保存を完了した後、`claude-plan.md` に従って実装を開始する
  - 実装対象のPhaseや範囲が指定されている場合はその範囲に従う
  - 指定がない場合は優先順位の最も高い未実装Phaseから着手する
  - **前提**: ユーザーが `claude --dangerously-skip-permissions` でセッションを起動していること

- **「修正後に再レビュー」等の場合**:
  - プランの更新・保存のみ行い、実装は行わない
  - 「更新しました。Codexに再レビューを依頼してください。」と表示する

## 注意

- 入力: `plan-review.md`（Codexのレビュー）+ `claude-plan.md`（現在のプラン）
- 出力: `claude-plan.md`（更新後のプラン）
- **毎回ファイルを読み直す**（前回読んだ内容を使わない）
- `plan-review.md` のフィードバックを正確に反映すること
- 実装時は `prisma db push` 禁止（`prisma migrate dev --name <変更内容>` を使う）
- マイグレーション後は `npx prisma generate` + `docker compose restart app` が必須
- STPスコープのサーバー検証は最優先で維持する
