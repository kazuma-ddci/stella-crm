-- 既存の予約確定/変更テンプレートをシンプルな文面に更新
-- プロライン側で「ご予約ありがとうございます」等の挨拶を送るため、
-- CRM側はZoom URLと日時情報のみ送信する

UPDATE "slp_zoom_message_templates"
SET "body" = E'【概要案内 Zoom URLのご案内】\n日時: {{日時}}\n担当: {{担当者}}\nZoom URL: {{url}}\n\n当日はこちらのURLよりご参加をお願いいたします。',
    "updated_at" = CURRENT_TIMESTAMP
WHERE "template_key" = 'briefing_confirm';

UPDATE "slp_zoom_message_templates"
SET "body" = E'【概要案内 変更後のZoom URLのご案内】\n新しい日時: {{日時}}\n担当: {{担当者}}\nZoom URL: {{url}}\n\n当日はこちらのURLよりご参加をお願いいたします。',
    "updated_at" = CURRENT_TIMESTAMP
WHERE "template_key" = 'briefing_change';

UPDATE "slp_zoom_message_templates"
SET "body" = E'【導入希望商談 Zoom URLのご案内】\n日時: {{日時}}\n担当: {{担当者}}\nZoom URL: {{url}}\n\n当日はこちらのURLよりご参加をお願いいたします。',
    "updated_at" = CURRENT_TIMESTAMP
WHERE "template_key" = 'consultation_confirm';

UPDATE "slp_zoom_message_templates"
SET "body" = E'【導入希望商談 変更後のZoom URLのご案内】\n新しい日時: {{日時}}\n担当: {{担当者}}\nZoom URL: {{url}}\n\n当日はこちらのURLよりご参加をお願いいたします。',
    "updated_at" = CURRENT_TIMESTAMP
WHERE "template_key" = 'consultation_change';

-- Zoom URL未発行時用テンプレート追加（自動作成が失敗した場合に送信される）
INSERT INTO "slp_zoom_message_templates" ("template_key", "category", "trigger", "label", "body", "updated_at") VALUES
  ('briefing_confirm_no_url', 'briefing', 'confirm_no_url', '概要案内 予約確定（URL未発行）',
   E'【概要案内のご案内】\n日時: {{日時}}\n担当: {{担当者}}\n\nZoom URLは準備でき次第、改めてお送りさせていただきます。',
   CURRENT_TIMESTAMP),
  ('briefing_change_no_url', 'briefing', 'change_no_url', '概要案内 予約変更（URL未発行）',
   E'【概要案内 変更のご案内】\n新しい日時: {{日時}}\n担当: {{担当者}}\n\nZoom URLは準備でき次第、改めてお送りさせていただきます。',
   CURRENT_TIMESTAMP),
  ('consultation_confirm_no_url', 'consultation', 'confirm_no_url', '導入希望商談 予約確定（URL未発行）',
   E'【導入希望商談のご案内】\n日時: {{日時}}\n担当: {{担当者}}\n\nZoom URLは準備でき次第、改めてお送りさせていただきます。',
   CURRENT_TIMESTAMP),
  ('consultation_change_no_url', 'consultation', 'change_no_url', '導入希望商談 予約変更（URL未発行）',
   E'【導入希望商談 変更のご案内】\n新しい日時: {{日時}}\n担当: {{担当者}}\n\nZoom URLは準備でき次第、改めてお送りさせていただきます。',
   CURRENT_TIMESTAMP);
