-- 契約書関連通知を Form15 に統合するためのマイグレーション
-- スキーマ変更なし（recipient / category は VARCHAR で新値追加のみ）
-- 新カテゴリ "contract" + 新 recipient "member" のテンプレを2件シード

-- 1. 契約書リマインド（組合員向け）
INSERT INTO "slp_notification_templates"
  ("recipient", "category", "round_type", "source", "trigger", "form_id", "label", "body", "is_active", "created_at", "updated_at")
SELECT
  'member',
  'contract',
  NULL,
  NULL,
  'contract_reminder',
  'form15',
  '契約書リマインド（組合員向け）',
  '【組合員契約書のお手続きについて】

いつもお世話になっております。

{{contractSentDate}}にお送りいたしました組合員契約書につきまして、現時点でお手続きが完了していないようでございます。

下記メールアドレス宛にクラウドサインよりご案内をお送りしておりますので、お手数ですが内容をご確認いただき、お手続きをお願いいたします。

送付先：{{contractSentEmail}}

ご不明な点がございましたら、お気軽にお問い合わせください。
何卒よろしくお願いいたします。',
  true,
  NOW(),
  NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM "slp_notification_templates"
  WHERE "recipient" = 'member'
    AND "category" = 'contract'
    AND "round_type" IS NULL
    AND "source" IS NULL
    AND "trigger" = 'contract_reminder'
);

-- 2. メール不達通知（組合員向け）※ 旧 Form15 ハードコード文面を踏襲
INSERT INTO "slp_notification_templates"
  ("recipient", "category", "round_type", "source", "trigger", "form_id", "label", "body", "is_active", "created_at", "updated_at")
SELECT
  'member',
  'contract',
  NULL,
  NULL,
  'contract_bounced',
  'form15',
  'メール不達通知（組合員向け）',
  '組合員入会の契約書をメールでお送りしましたが、メールが送信できませんでした。
お手数ですが、再度入会フォームを開いてメールアドレスをご確認ください。',
  true,
  NOW(),
  NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM "slp_notification_templates"
  WHERE "recipient" = 'member'
    AND "category" = 'contract'
    AND "round_type" IS NULL
    AND "source" IS NULL
    AND "trigger" = 'contract_bounced'
);
