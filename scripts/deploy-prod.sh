#!/bin/bash
set -e

cd ~/stella-crm

# .env.prod から CRON_SECRET を読み取る
CRON_SECRET=$(grep '^CRON_SECRET=' .env.prod | cut -d'=' -f2- | tr -d '"')
PROD_PORT=4001

echo ""
echo "========================================="
echo "  PROD デプロイ開始"
echo "========================================="
echo ""

# --- Step 1: デプロイ前にDBバックアップ ---
echo "[1/4] 本番DBバックアップ中..."
~/backup-prod-db.sh
echo "✅ バックアップ完了"
echo ""

# --- Step 2: GitHubから最新コードを取得 ---
echo "[2/4] 最新コードを取得中..."
git pull
echo "✅ git pull 完了"
echo ""

# --- Step 3: ビルド＆起動（ビルドを先に実行してダウンタイム最小化） ---
echo "[3/4] prod ビルド中..."
docker compose -f docker-compose.prod.yml build app
echo "✅ ビルド完了"
echo ""

echo "  コンテナ入れ替え中..."
docker compose -f docker-compose.prod.yml up -d app
echo "✅ prod 起動完了"
echo ""

# --- Step 4: ヘルスチェック ---
echo "[4/4] ヘルスチェック実行中..."
echo ""

# 起動待ち（最大60秒）
for i in $(seq 1 12); do
  if curl -s -o /dev/null -w "%{http_code}" http://localhost:$PROD_PORT | grep -q "200\|301\|302\|307\|308"; then
    break
  fi
  if [ "$i" -eq 12 ]; then
    echo "❌ サーバーが60秒以内に起動しませんでした"
    echo "   docker compose -f docker-compose.prod.yml logs app --tail 30"
    exit 1
  fi
  sleep 5
done

# ヘルスチェックAPI実行
HEALTH_RESULT=$(curl -s -H "Authorization: Bearer $CRON_SECRET" http://localhost:$PROD_PORT/api/health)

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
echo "  PROD デプロイ完了！"
echo "========================================="
