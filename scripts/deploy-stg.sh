#!/bin/bash
set -e

cd ~/stella-crm

echo ""
echo "========================================="
echo "  STG デプロイ開始"
echo "========================================="
echo ""

# --- Step 1: GitHubから最新コードを取得 ---
echo "[1/4] 最新コードを取得中..."
git pull
echo "✅ git pull 完了"
echo ""

# --- Step 2: 本番DBのデータをstg DBにコピー ---
echo "[2/4] 本番DBをstg DBにコピー中..."
BACKUP_FILE="/tmp/prod-for-stg-$(date +%Y%m%d%H%M%S).sql.gz"

docker compose -f docker-compose.prod.yml exec -T db-prod \
  pg_dump -U stella_user crm_prod | gzip > "$BACKUP_FILE"
echo "  本番バックアップ取得完了 ($(du -h "$BACKUP_FILE" | cut -f1))"

docker compose -f docker-compose.stg.yml exec -T db-stg \
  psql -U stella_user crm_stg -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;" 2>/dev/null
echo "  stg DB クリア完了"

gunzip -c "$BACKUP_FILE" | \
  docker compose -f docker-compose.stg.yml exec -T db-stg \
  psql -U stella_user crm_stg > /dev/null 2>&1
echo "  本番データのリストア完了"

rm "$BACKUP_FILE"
echo "✅ 本番DB → stg DBコピー完了"
echo ""

# --- Step 3: stg ビルド＆起動（マイグレーションも自動実行される） ---
echo "[3/4] stg ビルド＆起動中..."
docker compose -f docker-compose.stg.yml up -d --build app
echo "✅ stg ビルド＆起動完了"
echo ""

# --- Step 4: 起動確認 ---
echo "[4/4] stg 起動確認中..."
sleep 5
if curl -s -o /dev/null -w "%{http_code}" http://localhost:4000 | grep -q "200\|302"; then
  echo "✅ stg 正常起動確認 (http://localhost:4000)"
else
  echo "⚠️  まだ起動中かも。少し待ってからブラウザで確認してください"
fi

echo ""
echo "========================================="
echo "  STG デプロイ完了！"
echo "  ブラウザで確認 → OKなら: ~/deploy-prod.sh"
echo "========================================="
