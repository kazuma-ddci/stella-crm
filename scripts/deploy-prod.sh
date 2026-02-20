#!/bin/bash
set -e

cd ~/stella-crm

echo ""
echo "========================================="
echo "  PROD デプロイ開始"
echo "========================================="
echo ""

# --- Step 1: デプロイ前にDBバックアップ ---
echo "[1/3] 本番DBバックアップ中..."
~/backup-prod-db.sh
echo "✅ バックアップ完了"
echo ""

# --- Step 2: GitHubから最新コードを取得 ---
echo "[2/3] 最新コードを取得中..."
git pull
echo "✅ git pull 完了"
echo ""

# --- Step 3: ビルド＆起動 ---
echo "[3/3] prod ビルド＆起動中..."
docker compose -f docker-compose.prod.yml up -d --build app
echo "✅ prod ビルド＆起動完了"
echo ""

echo "========================================="
echo "  PROD デプロイ完了！"
echo "========================================="
