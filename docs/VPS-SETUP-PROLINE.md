# ProLine連携 — VPSセットアップ手順

`git push` → `~/deploy-prod.sh` 完了後に、以下を順番に実行してください。

---

## 1. 環境変数ファイル作成

```bash
cp ~/stella-crm/scripts/sync-proline-env.example ~/stella-crm/scripts/.env.sync
```

ファイルを編集して値を埋める:
```bash
nano ~/stella-crm/scripts/.env.sync
```

中身:
```
PROLINE_EMAIL=metatrust717@gmail.com
PROLINE_PASSWORD=meta2025
PROLINE_LOGIN_UID=bwufzy
CRON_SECRET=（.env.prodのCRON_SECRETと同じ値）
APP_URL=http://localhost:4001
```

`CRON_SECRET` の値を確認するには:
```bash
grep CRON_SECRET ~/stella-crm/.env.prod
```

---

## 2. Puppeteer・xlsx をVPSホストにインストール

```bash
cd ~/stella-crm/scripts
npm init -y
npm install puppeteer xlsx
```

Puppeteerが必要とするChromiumの依存ライブラリ（未インストールの場合）:
```bash
apt-get update && apt-get install -y \
  libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 \
  libxkbcommon0 libxcomposite1 libxdamage1 libxrandr2 libgbm1 \
  libpango-1.0-0 libcairo2 libasound2
```

---

## 3. 動作テスト（同期スクリプト単体）

```bash
cd ~/stella-crm/scripts
node sync-proline.mjs
```

- ProLineにログイン → Excelダウンロード → API送信 が成功すれば OK
- エラーが出たら `.env.sync` の値やChromium依存を確認

---

## 4. トリガーサーバーの systemd 登録

サービスファイル作成:
```bash
cat > /etc/systemd/system/proline-sync-trigger.service << 'EOF'
[Unit]
Description=ProLine Sync Trigger Server
After=network.target

[Service]
Type=simple
WorkingDirectory=/root/stella-crm/scripts
ExecStart=/usr/bin/node sync-trigger-server.mjs
Restart=always
EnvironmentFile=/root/stella-crm/scripts/.env.sync

[Install]
WantedBy=multi-user.target
EOF
```

有効化・起動:
```bash
systemctl daemon-reload
systemctl enable proline-sync-trigger
systemctl start proline-sync-trigger
```

起動確認:
```bash
systemctl status proline-sync-trigger
```

動作確認:
```bash
# CRON_SECRETの値に置き換えて実行
curl "http://127.0.0.1:3100/health"
curl "http://127.0.0.1:3100/trigger?secret=ここにCRON_SECRETの値"
```

---

## 5. crontab 登録（毎時同期）

ログディレクトリ作成:
```bash
mkdir -p ~/logs
```

crontab追加:
```bash
crontab -e
```

以下の行を追加:
```
0 * * * * node ~/stella-crm/scripts/sync-proline.mjs >> ~/logs/proline-sync.log 2>&1
```

---

## 6. .env.prod に環境変数追加

```bash
nano ~/stella-crm/.env.prod
```

以下を追加:
```
LINE_FRIEND_WEBHOOK_SECRET=（本番用のランダム文字列を設定）
PROLINE_SYNC_TRIGGER_URL=http://host.docker.internal:3100
```

`LINE_FRIEND_WEBHOOK_SECRET` はランダム文字列を生成して設定:
```bash
openssl rand -base64 32
```

追加後、アプリを再起動:
```bash
cd ~/stella-crm && docker compose -f docker-compose.prod.yml restart app
```

---

## 7. ProLine側のWebhook設定

ProLine管理画面で、友だち追加時のWebhook URLを以下に設定:

```
https://crm.stella-international.co.jp/api/public/slp/line-friend-webhook?uid=[[uid]]&snsname=%%%%snsname%%%%&secret=（LINE_FRIEND_WEBHOOK_SECRETの値）
```

---

## 確認チェックリスト

- [ ] `.env.sync` 作成・値設定済み
- [ ] `npm install puppeteer xlsx` 完了
- [ ] `node sync-proline.mjs` 単体テスト成功
- [ ] systemd トリガーサーバー起動確認
- [ ] `curl http://127.0.0.1:3100/health` → `{"status":"ok"}`
- [ ] crontab 登録済み
- [ ] `.env.prod` に `LINE_FRIEND_WEBHOOK_SECRET` と `PROLINE_SYNC_TRIGGER_URL` 追加済み
- [ ] アプリ再起動済み
- [ ] ProLine側Webhook URL設定済み
- [ ] CRM画面の「ProLine同期」ボタン押下 → 同期成功
