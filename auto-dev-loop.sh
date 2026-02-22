#!/bin/bash
###############################################################################
# auto-dev-loop.sh
# 
# Claude Code（実装）× Claude Code（レビュー）自動開発ループ
# 
# 【動作の流れ】
#   1. TASKS.md から次の未完了タスクを読み込む
#   2. Claude Code（実装役）が実装する
#   3. Claude Code（レビュー役）がレビューする
#   4. OK → git commit → 次のタスクへ
#   5. NG → フィードバックを渡して修正 → 再レビュー（最大3回）
#   6. 全タスク完了まで繰り返す
#
# 【使い方】
#   chmod +x auto-dev-loop.sh
#   ./auto-dev-loop.sh
#
###############################################################################

set -euo pipefail

# ============ 設定 ============
TASKS_FILE="TASKS.md"
LOG_DIR="./dev-logs"
MAX_RETRIES=3
SPEC_REQUIREMENTS="docs/specs/SPEC-ACCOUNTING-001-requirements.md"
SPEC_DESIGN="docs/specs/SPEC-ACCOUNTING-001-design.md"

# ============ 初期化 ============
mkdir -p "$LOG_DIR"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
MAIN_LOG="$LOG_DIR/main_${TIMESTAMP}.log"

# ============ ユーティリティ ============
log() {
  local msg="[$(date '+%Y-%m-%d %H:%M:%S')] $1"
  echo "$msg" | tee -a "$MAIN_LOG"
}

get_next_task() {
  grep -n '^\- \[ \]' "$TASKS_FILE" | head -1 || true
}

mark_task_done() {
  local task_line_num=$1
  if [[ "$OSTYPE" == "darwin"* ]]; then
    sed -i '' "${task_line_num}s/- \[ \]/- [x]/" "$TASKS_FILE"
  else
    sed -i "${task_line_num}s/- \[ \]/- [x]/" "$TASKS_FILE"
  fi
  log "✅ タスク完了マーク（行: $task_line_num）"
}

mark_task_failed() {
  local task_line_num=$1
  if [[ "$OSTYPE" == "darwin"* ]]; then
    sed -i '' "${task_line_num}s/- \[ \]/- [!]/" "$TASKS_FILE"
  else
    sed -i "${task_line_num}s/- \[ \]/- [!]/" "$TASKS_FILE"
  fi
}

get_task_detail() {
  local task_line_num=$1
  local next_task_line
  next_task_line=$(grep -n '^\- \[' "$TASKS_FILE" | awk -F: -v current="$task_line_num" '$1 > current {print $1; exit}')
  
  if [ -z "$next_task_line" ]; then
    sed -n "${task_line_num},\$p" "$TASKS_FILE"
  else
    local end_line=$((next_task_line - 1))
    sed -n "${task_line_num},${end_line}p" "$TASKS_FILE"
  fi
}

# ============ Claude Code 実装 ============
run_implement() {
  local task_id=$1
  local task_detail=$2
  local retry_feedback=$3
  local step_log="$LOG_DIR/${task_id}_implement_$(date +%H%M%S).md"
  
  log "🔨 [実装] $task_id"
  
  local prompt=""
  
  if [ -z "$retry_feedback" ]; then
    prompt="あなたはstella-crmプロジェクトの経理・財務管理システムを実装するエンジニアです。

## 絶対に守るルール
- 設計書のPrismaスキーマに完全に従う（カラム名、型、リレーション、デフォルト値、全て一致）
- 要望書のビジネスロジックを正確に実装する
- 既存のコードパターンを踏襲する（先に既存コードを読んで確認）
- Server Actions パターン（Next.js App Router）で実装する

## 参照すべき仕様書（必ず読んでから実装すること）
- 要望書: $SPEC_REQUIREMENTS
- 設計書: $SPEC_DESIGN

## 今回のタスク
$task_detail

## 実装手順
1. まず設計書・要望書の該当セクションを読む
2. src/ 以下の既存コードのパターンを確認する
3. 実装する
4. npx tsc --noEmit でコンパイルエラーを確認し、あれば修正する

実装を開始してください。"
  else
    prompt="前回の実装に対してレビューで指摘がありました。全て修正してください。

## タスク
$task_detail

## レビューからの指摘事項
$retry_feedback

## 参照すべき仕様書
- 要望書: $SPEC_REQUIREMENTS
- 設計書: $SPEC_DESIGN

## 修正ルール
1. 指摘された箇所を全て修正する
2. 設計書・要望書との整合性を再確認する
3. npx tsc --noEmit でコンパイルエラーがないことを確認する

修正を開始してください。"
  fi
  
  echo "$prompt" | claude --dangerously-skip-permissions 2>&1 | tee "$step_log"
  log "📝 実装ログ: $step_log"
}

# ============ Claude Code レビュー ============
run_review() {
  local task_id=$1
  local task_detail=$2
  local review_log="$LOG_DIR/${task_id}_review_$(date +%H%M%S).md"
  
  log "🔍 [レビュー] $task_id"

  local review_prompt="あなたはstella-crmプロジェクトのシニアコードレビュアーです。
直前のgitコミットの実装内容をレビューしてください。

## 最重要: 仕様書との整合性
以下を必ず読んで、実装が仕様に忠実かチェックしてください：
- 要望書: $SPEC_REQUIREMENTS
- 設計書: $SPEC_DESIGN

## レビュー対象タスク
$task_detail

## レビュー手順
1. git diff HEAD~1 で変更内容を確認する
2. 設計書・要望書の該当セクションを読む
3. 以下の観点でチェックする

## チェック観点
1. 【テーブル定義】Prismaスキーマが設計書と完全一致か（カラム名、型、リレーション、デフォルト値）
2. 【ビジネスロジック】要望書のフロー・ステータス遷移が正しいか
3. 【バリデーション】設計書セクション6のルールが実装されているか
4. 【排他制約】設計書6.7のポリモーフィック参照が正しいか
5. 【コード品質】TypeScript型安全性、エラーハンドリング
6. 【既存パターン】プロジェクトの既存コードパターンに従っているか

## 出力フォーマット（この形式で必ず出力すること）

最後に必ず以下のJSON形式で結論を出力してください:

\`\`\`json
{
  \"verdict\": \"OK または NG\",
  \"issues\": [
    {
      \"severity\": \"critical または major または minor\",
      \"file\": \"対象ファイルパス\",
      \"description\": \"問題の説明\",
      \"suggestion\": \"具体的な修正案\"
    }
  ],
  \"summary\": \"全体評価\"
}
\`\`\`

判定基準:
- critical または major が1つでもあれば → verdict: \"NG\"
- minor のみ → verdict: \"OK\"（改善点としてリストは残す）
- 問題なし → verdict: \"OK\"、issues: []

レビューを開始してください。"

  echo "$review_prompt" | claude --dangerously-skip-permissions 2>&1 | tee "$review_log"
  log "📝 レビューログ: $review_log"
  
  # verdict を抽出
  if grep -q '"verdict"' "$review_log"; then
    local verdict
    verdict=$(grep -o '"verdict"[[:space:]]*:[[:space:]]*"[^"]*"' "$review_log" | tail -1 | grep -o '"OK"\|"NG"' | tr -d '"')
    echo "${verdict:-NG}"
  else
    log "⚠️ レビュー結果のJSON解析失敗。NGとして扱います。"
    echo "NG"
  fi
}

get_review_feedback() {
  local task_id=$1
  local latest_review
  latest_review=$(ls -t "$LOG_DIR"/${task_id}_review_*.md 2>/dev/null | head -1)
  if [ -n "$latest_review" ]; then
    cat "$latest_review"
  else
    echo "レビューログが見つかりません"
  fi
}

# ============ メインループ ============
main() {
  log "🚀 自動開発ループを開始します"
  log "📋 タスクファイル: $TASKS_FILE"
  log "📖 要望書: $SPEC_REQUIREMENTS"
  log "📖 設計書: $SPEC_DESIGN"
  
  if [ ! -f "$TASKS_FILE" ]; then
    log "❌ $TASKS_FILE が見つかりません"
    exit 1
  fi
  
  if [ ! -f "$SPEC_REQUIREMENTS" ] || [ ! -f "$SPEC_DESIGN" ]; then
    log "❌ 仕様書が見つかりません。docs/specs/ を確認してください"
    exit 1
  fi
  
  local completed=0
  local failed=0
  
  while true; do
    local next_task
    next_task=$(get_next_task)
    
    if [ -z "$next_task" ]; then
      log ""
      log "🎉 全タスク処理完了！"
      break
    fi
    
    local task_line_num
    task_line_num=$(echo "$next_task" | cut -d: -f1)
    local task_title
    task_title=$(echo "$next_task" | cut -d: -f2- | sed 's/^- \[ \] //')
    local task_id
    task_id=$(echo "$task_title" | grep -o 'TASK-[0-9]*' || echo "TASK-UNKNOWN")
    local task_detail
    task_detail=$(get_task_detail "$task_line_num")
    
    log ""
    log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    log "📌 開始: $task_title"
    log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    
    local retry=0
    local feedback=""
    local success=false
    
    while [ $retry -lt $MAX_RETRIES ]; do
      # Step 1: 実装
      run_implement "$task_id" "$task_detail" "$feedback"
      
      # Step 2: git commit
      git add -A 2>/dev/null || true
      git commit -m "feat($task_id): 実装 (attempt $((retry+1)))" --allow-empty 2>/dev/null || true
      
      # Step 3: レビュー
      local verdict
      verdict=$(run_review "$task_id" "$task_detail")
      
      if [ "$verdict" = "OK" ]; then
        log "✅ レビュー OK！"
        mark_task_done "$task_line_num"
        completed=$((completed + 1))
        success=true
        break
      else
        retry=$((retry + 1))
        log "⚠️ レビュー NG（リトライ: $retry/$MAX_RETRIES）"
        feedback=$(get_review_feedback "$task_id")
      fi
    done
    
    if [ "$success" = false ]; then
      log "❌ 失敗（リトライ上限）: $task_title"
      mark_task_failed "$task_line_num"
      failed=$((failed + 1))
      
      git add -A 2>/dev/null || true
      git commit -m "wip($task_id): レビュー未通過 - 手動対応が必要" --allow-empty 2>/dev/null || true
      
      log "⏭️ 次のタスクへスキップ..."
    fi
  done
  
  log ""
  log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  log "🏁 完了"
  log "📊 成功: $completed 件 / 失敗: $failed 件"
  log "📁 ログ: $LOG_DIR/"
  log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
}

main
