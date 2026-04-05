#!/bin/bash
set -e

cd ~/stella-crm

# .env.demo から CRON_SECRET を読み取る
CRON_SECRET=$(grep '^CRON_SECRET=' .env.demo | cut -d'=' -f2- | tr -d '"')
DEMO_PORT=4002

echo ""
echo "========================================="
echo "  DEMO デプロイ開始"
echo "========================================="
echo ""

# --- Step 1: GitHubから最新コードを取得 ---
echo "[1/4] 最新コードを取得中..."
git pull
echo "✅ git pull 完了"
echo ""

# --- Step 2: DB初期化（初回のみ） ---
# demo DBにデータがあるかチェック
DB_EXISTS=$(docker compose --env-file .env.demo -f docker-compose.demo.yml exec -T db-demo \
  psql -U stella_user crm_demo -tAc \
  "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = '_prisma_migrations');" 2>/dev/null || echo "false")

if [ "$DB_EXISTS" = "t" ] || [ "$DB_EXISTS" = "true" ]; then
  echo "[2/4] demo DBにデータあり → スキップ（既存データを保持）"
  echo "  ※ 初期化し直したい場合: ~/init-demo-db.sh"
else
  echo "[2/4] demo DBが空です → 本番DBからコピー中..."
  BACKUP_FILE="/tmp/prod-for-demo-$(date +%Y%m%d%H%M%S).sql.gz"

  docker compose --env-file .env.prod -f docker-compose.prod.yml exec -T db-prod \
    pg_dump -U stella_user crm_prod | gzip > "$BACKUP_FILE"
  echo "  本番バックアップ取得完了 ($(du -h "$BACKUP_FILE" | cut -f1))"

  gunzip -c "$BACKUP_FILE" | \
    docker compose --env-file .env.demo -f docker-compose.demo.yml exec -T db-demo \
    psql -U stella_user crm_demo > /dev/null 2>&1
  echo "  本番データのリストア完了"

  rm "$BACKUP_FILE"
  echo "✅ 本番DB → demo DBコピー完了"
fi
echo ""

# --- Step 3: ビルド ---
echo "[3/4] demo ビルド中..."
docker compose --env-file .env.demo -f docker-compose.demo.yml build app
echo "✅ ビルド完了"
echo ""

# --- Step 4: コンテナ入れ替え＆起動 ---
echo "[4/4] demo コンテナ入れ替え中..."
docker compose --env-file .env.demo -f docker-compose.demo.yml up -d app
echo "✅ demo 起動完了"
echo ""

# --- ヘルスチェック ---
echo "ヘルスチェック実行中..."
echo ""

# 起動待ち（最大60秒）
for i in $(seq 1 12); do
  if curl -s -o /dev/null -w "%{http_code}" http://localhost:$DEMO_PORT | grep -q "200\|301\|302\|307\|308"; then
    break
  fi
  if [ "$i" -eq 12 ]; then
    echo "❌ サーバーが60秒以内に起動しませんでした"
    echo "   docker compose --env-file .env.demo -f docker-compose.demo.yml logs app --tail 30"
    exit 1
  fi
  sleep 5
done

# ヘルスチェックAPI実行
HEALTH_RESULT=$(curl -s -H "Authorization: Bearer $CRON_SECRET" http://localhost:$DEMO_PORT/api/health)

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
echo "  DEMO デプロイ完了！"
echo "  URL: http://$(hostname -I 2>/dev/null | awk '{print $1}' || echo 'VPS_IP'):$DEMO_PORT"
echo "========================================="
