-- 紹介者通知を Form18 に統合するためのマイグレーション
-- 1. SlpZoomSendLog.company_record_id を nullable 化（セッション非依存の紹介者通知も記録するため）
-- 2. 新カテゴリ "referral" のテンプレ2件をシード（friend_added / contract_signed）

-- 1. company_record_id を nullable 化
ALTER TABLE "slp_zoom_send_logs"
  ALTER COLUMN "company_record_id" DROP NOT NULL;

-- 2. 新テンプレ（紹介ライフサイクル）をシード
-- NULL を含むユニーク制約では ON CONFLICT が効かないため WHERE NOT EXISTS で冪等性担保
INSERT INTO "slp_notification_templates"
  ("recipient", "category", "round_type", "source", "trigger", "form_id", "label", "body", "is_active", "created_at", "updated_at")
SELECT
  'referrer',
  'referral',
  NULL,
  NULL,
  'friend_added',
  'form18',
  '友達追加通知（紹介者向け）',
  'ご紹介ありがとうございます！

ご紹介いただいた{{addedFriendLineName}}様が
公式LINEへご登録されました。

引き続き進捗があり次第
ご連絡させていただきます。

ご紹介いただき誠にありがとうございます。',
  true,
  NOW(),
  NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM "slp_notification_templates"
  WHERE "recipient" = 'referrer'
    AND "category" = 'referral'
    AND "round_type" IS NULL
    AND "source" IS NULL
    AND "trigger" = 'friend_added'
);

INSERT INTO "slp_notification_templates"
  ("recipient", "category", "round_type", "source", "trigger", "form_id", "label", "body", "is_active", "created_at", "updated_at")
SELECT
  'referrer',
  'referral',
  NULL,
  NULL,
  'contract_signed',
  'form18',
  '契約締結通知（紹介者向け）',
  'ご紹介いただいた{{memberName}}様（LINE名：{{memberLineName}}）が
組合員契約の締結まで完了しました。

ご紹介いただき誠にありがとうございます。

引き続き制度導入に向けた
進捗についてもご共有させていただきます。',
  true,
  NOW(),
  NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM "slp_notification_templates"
  WHERE "recipient" = 'referrer'
    AND "category" = 'referral'
    AND "round_type" IS NULL
    AND "source" IS NULL
    AND "trigger" = 'contract_signed'
);
