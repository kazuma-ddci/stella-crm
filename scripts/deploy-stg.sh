#!/bin/bash
set -e

cd ~/stella-crm

# .env.stg から CRON_SECRET を読み取る
CRON_SECRET=$(grep '^CRON_SECRET=' .env.stg | cut -d'=' -f2- | tr -d '"')
STG_PORT=4000

echo ""
echo "========================================="
echo "  STG デプロイ開始"
echo "========================================="
echo ""

# --- Step 1: GitHubから最新コードを取得 ---
echo "[1/5] 最新コードを取得中..."
git pull
echo "✅ git pull 完了"
echo ""

# --- Step 2: 本番DBのデータをstg DBにコピー ---
echo "[2/5] 本番DBをstg DBにコピー中..."
BACKUP_FILE="/tmp/prod-for-stg-$(date +%Y%m%d%H%M%S).sql.gz"

docker compose --env-file .env.prod -f docker-compose.prod.yml exec -T db-prod \
  pg_dump -U stella_user crm_prod | gzip > "$BACKUP_FILE"
echo "  本番バックアップ取得完了 ($(du -h "$BACKUP_FILE" | cut -f1))"

docker compose --env-file .env.stg -f docker-compose.stg.yml exec -T db-stg \
  psql -U stella_user crm_stg -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;" 2>/dev/null
echo "  stg DB クリア完了"

gunzip -c "$BACKUP_FILE" | \
  docker compose --env-file .env.stg -f docker-compose.stg.yml exec -T db-stg \
  psql -U stella_user crm_stg > /dev/null 2>&1
echo "  本番データのリストア完了"

rm "$BACKUP_FILE"
echo "✅ 本番DB → stg DBコピー完了"
echo ""

# --- Step 3: ビルド（旧コンテナ稼働中にビルドしてダウンタイム最小化） ---
echo "[3/5] stg ビルド中..."
docker compose --env-file .env.stg -f docker-compose.stg.yml build app
echo "✅ ビルド完了"
echo ""

# --- Step 4: コンテナ入れ替え＆起動 ---
echo "[4/5] stg コンテナ入れ替え中..."
docker compose --env-file .env.stg -f docker-compose.stg.yml up -d app
echo "✅ stg 起動完了"
echo ""

# --- Step 5: ヘルスチェック ---
echo "[5/5] ヘルスチェック実行中..."
echo ""

# 起動待ち（最大60秒）
for i in $(seq 1 12); do
  if curl -s -o /dev/null -w "%{http_code}" http://localhost:$STG_PORT | grep -q "200\|301\|302\|307\|308"; then
    break
  fi
  if [ "$i" -eq 12 ]; then
    echo "❌ サーバーが60秒以内に起動しませんでした"
    echo "   docker compose --env-file .env.stg -f docker-compose.stg.yml logs app --tail 30"
    exit 1
  fi
  sleep 5
done

# ヘルスチェックAPI実行
HEALTH_RESULT=$(curl -s -H "Authorization: Bearer $CRON_SECRET" http://localhost:$STG_PORT/api/health)

if [ -z "$HEALTH_RESULT" ]; then
  echo "⚠️  ヘルスチェックAPIから応答なし"
else
  STATUS=$(echo "$HEALTH_RESULT" | python3 -c "import sys,json; print(json.load(sys.stdin)['status'])" 2>/dev/null || echo "unknown")

  if [ "$STATUS" = "ok" ]; then
    echo "✅ ヘルスチェック: 全項目OK"
  elif [ "$STATUS" = "degraded" ]; then
    echo "⚠️  ヘルスチェック: 一部警告あり"
  else
    echo "❌ ヘルスチェック: エラーあり"
  fi

  # 詳細を表示
  echo ""
  echo "$HEALTH_RESULT" | python3 -c "
import sys, json
data = json.load(sys.stdin)
for check in data.get('checks', []):
    icon = '✅' if check['status'] == 'ok' else '⚠️ ' if check['status'] == 'warn' else '❌'
    msg = f\" — {check['message']}\" if check.get('message') else ''
    print(f\"  {icon} {check['name']} ({check['durationMs']}ms){msg}\")
" 2>/dev/null || echo "  (詳細表示に失敗。レスポンス: $HEALTH_RESULT)"
fi

echo ""
echo "========================================="
echo "  STG デプロイ完了！"
echo "  ブラウザで確認 → OKなら: ~/deploy-prod.sh"
echo "========================================="
