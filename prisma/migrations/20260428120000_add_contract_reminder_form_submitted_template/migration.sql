-- フォーム送信経由の自動リマインド用 LINE 通知テンプレを追加
-- 既存 `contract_reminder` は Cron 経由のまま残し、フォーム経由は別本文で送る
-- スキーマ変更なし（trigger は VARCHAR）

INSERT INTO "slp_notification_templates"
  ("recipient", "category", "round_type", "source", "trigger", "form_id", "label", "body", "is_active", "created_at", "updated_at")
SELECT
  'member',
  'contract',
  NULL,
  NULL,
  'contract_reminder_form_submitted',
  'form15',
  '契約書リマインド（フォーム送信経由）',
  '【組合員入会手続きのご確認】

お世話になっております。

{{contractSentDate}}にお送りしております
組合員契約書につきまして
現在お手続きが未完了の状態となっております。

再度リマインド送付致しましたので、
クラウドサインよりメールが届いているかと存じます。
内容をご確認のうえご対応をお願いいたします。

送付先メールアドレス
{{contractSentEmail}}

入会完了後、担当者より
次のご案内をさせていただきます。

ご不明点がございましたら
お気軽にご連絡ください。',
  true,
  NOW(),
  NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM "slp_notification_templates"
  WHERE "recipient" = 'member'
    AND "category" = 'contract'
    AND "round_type" IS NULL
    AND "source" IS NULL
    AND "trigger" = 'contract_reminder_form_submitted'
);
