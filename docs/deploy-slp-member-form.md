# SLP 組合員入会申込フォーム — VPSデプロイ後の作業

## 概要

組合員入会申込フォーム機能をVPSにデプロイした後、以下の作業が必要です。

---

## 1. マイグレーション適用（デプロイスクリプトで自動実行）

通常のデプロイフロー（`~/deploy-stg.sh` / `~/deploy-prod.sh`）で `prisma migrate deploy` が実行されるため、追加作業は不要です。

念のため、デプロイ後にマイグレーションが適用されていることを確認してください:

```bash
# stg
docker compose -f docker-compose.stg.yml exec app npx prisma migrate deploy

# prod
docker compose -f docker-compose.prod.yml exec app npx prisma migrate deploy
```

---

## 2. 環境変数の設定

### 必須: SLPプロジェクトの運営法人にCloudSign APIキーが設定されていること

OS（Stella CRM）の管理画面で確認:
- `/settings/operating-companies` → SLP用の運営法人を開く
- 「CloudSign Client ID」に APIキー（`9339d535-f804-45c1-8463-35b7af6d1b04`）が設定されていること

**もし未設定の場合:**
管理画面から設定するか、以下のSQLで直接設定:

```sql
-- まず SLP プロジェクトの運営法人IDを確認
SELECT p.id, p.name, p.code, p."operatingCompanyId",
       oc."companyName", oc."cloudsignClientId"
FROM master_projects p
LEFT JOIN operating_companies oc ON oc.id = p."operatingCompanyId"
WHERE p.code = 'slp';

-- 運営法人のCloudSign Client IDを設定（operatingCompanyIdを置き換え）
UPDATE operating_companies
SET "cloudsignClientId" = '9339d535-f804-45c1-8463-35b7af6d1b04'
WHERE id = <運営法人のID>;
```

### 任意: テンプレートID（通常は不要）

GASと同じテンプレートIDがデフォルト値として組み込まれています。
別のテンプレートを使う場合のみ、`.env.prod` に追加:

```
SLP_CLOUDSIGN_TEMPLATE_ID=01mtxrn6zyv4p85xf498m75p3fjvnfnw
```

---

## 3. CloudSign Webhook URL の設定確認

CloudSign管理画面（https://www.cloudsign.jp）で、Webhook URLが設定されていることを確認:

- **本番**: `https://<本番ドメイン>/api/cloudsign/webhook`
- **stg**: `https://<stgドメイン>/api/cloudsign/webhook`

これは既にSTP用に設定済みのはず。SLPの契約書もこの同じWebhookで自動処理されます（既存のWebhookを拡張済み）。

---

## 4. 自動リマインドのcron設定

VPSのcrontabに以下を追加:

```bash
crontab -e
```

```
# SLP 組合員契約書の自動リマインド（毎日10時）
0 10 * * * curl -s -H "Authorization: Bearer $(grep CRON_SECRET ~/stella-crm/.env.prod | cut -d= -f2-)" http://localhost:4001/api/cron/remind-slp-members >> ~/logs/slp-remind.log 2>&1
```

ログディレクトリの確認:
```bash
mkdir -p ~/logs
```

---

## 5. 動作確認

### 5-1. フォームへのアクセス確認

ブラウザで以下のURLにアクセスして、フォームが表示されることを確認:

```
https://<ドメイン>/form/slp-member?lineName=テスト&uid=test-uid-001&free1=referrer-uid
```

- ブラウザタブのタイトルが「組合員入会申込フォーム」になっていること
- LINE名が「テスト」で自動入力されていること

### 5-2. UIDなしアクセスのエラー確認

```
https://<ドメイン>/form/slp-member
```

- エラーメッセージが表示されること

### 5-3. Webhook疎通確認

```bash
curl https://<ドメイン>/api/cloudsign/webhook
# → {"ok":true,"service":"cloudsign-webhook"}
```

### 5-4. 自動リマインドの疎通確認

```bash
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:4001/api/cron/remind-slp-members
# → {"success":true,"total":0,"succeeded":0,"failed":0,"results":[]}
```

---

## 6. LINE公式でのフォームURL設定

ProLine（LINE公式アカウント管理）でフォーム送信時のURLを以下の形式に設定:

```
https://<ドメイン>/form/slp-member?lineName={{LINE名}}&uid={{UID}}&free1={{free1}}
```

※ `{{LINE名}}`, `{{UID}}`, `{{free1}}` はProLineの変数置換構文に合わせてください。

---

## 7. GASからの移行について

この機能は既存のGoogleフォーム + GASで実装されていた以下の機能をCRM側に移植したものです:

| GAS機能 | CRM対応 |
|---------|---------|
| フォーム送信 → スプレッドシート書き込み | → SlpMemberテーブルに保存 |
| フォーム送信 → CloudSign契約書自動送付 | → `/api/public/slp/member-registration` で自動送付 |
| CloudSign Webhook → ステータス更新 | → `/api/cloudsign/webhook` でSlpMemberも自動更新 |
| 7日後の自動リマインド | → `/api/cron/remind-slp-members` (crontab) |
| スプレッドシートからの手動リマインド | → 組合員名簿の「リマインド送付」ボタン |

**GASの無効化タイミング**: CRM側で正常動作を確認後、GASのトリガーを無効化してください。両方が同時に動くと二重送付になります。
