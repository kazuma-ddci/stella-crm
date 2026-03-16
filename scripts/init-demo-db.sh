#!/bin/bash
set -e

cd ~/stella-crm

echo ""
echo "========================================="
echo "  DEMO DB 初期化（本番データで上書き）"
echo "========================================="
echo ""
echo "⚠️  demo DBの現在のデータは全て消えます。"
read -p "続行しますか？ (y/N): " confirm
if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
  echo "中止しました。"
  exit 0
fi
echo ""

# DB起動確認
docker compose -f docker-compose.demo.yml up -d db-demo
sleep 3

# 本番DBダンプ
echo "本番DBをダンプ中..."
BACKUP_FILE="/tmp/prod-for-demo-$(date +%Y%m%d%H%M%S).sql.gz"
docker compose -f docker-compose.prod.yml exec -T db-prod \
  pg_dump -U stella_user crm_prod | gzip > "$BACKUP_FILE"
echo "✅ ダンプ完了 ($(du -h "$BACKUP_FILE" | cut -f1))"

# demo DBクリア＆リストア
echo "demo DBをクリア＆リストア中..."
docker compose -f docker-compose.demo.yml exec -T db-demo \
  psql -U stella_user crm_demo -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;" 2>/dev/null

gunzip -c "$BACKUP_FILE" | \
  docker compose -f docker-compose.demo.yml exec -T db-demo \
  psql -U stella_user crm_demo > /dev/null 2>&1

rm "$BACKUP_FILE"
echo "✅ 本番DB → demo DBコピー完了"

# アプリ再起動
echo "demo アプリを再起動中..."
docker compose -f docker-compose.demo.yml restart app
echo ""
echo "========================================="
echo "  DEMO DB 初期化完了！"
echo "  手動でデータを編集してください。"
echo "========================================="
