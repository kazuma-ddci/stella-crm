-- Prevent duplicate V2 contact histories for a single external/source-backed record.
-- PostgreSQL UNIQUE permits multiple rows when source_ref_id is NULL, so manual
-- V2 contact histories (source_type='manual', source_ref_id=NULL) remain allowed.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "contact_histories_v2"
    WHERE "source_ref_id" IS NOT NULL
    GROUP BY "source_type", "source_ref_id"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION
      'Cannot add contact_histories_v2(source_type, source_ref_id) unique index: duplicate source-backed histories exist';
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "contact_histories_v2_source_type_source_ref_id_key"
  ON "contact_histories_v2" ("source_type", "source_ref_id");

-- URL未発行時に通常の {{zoomUrl}} テンプレートへ壊れた値を流さないための
-- お客様向けテンプレート。文面は管理画面から後で調整可能。
WITH combos AS (
  SELECT *
  FROM (VALUES
    ('briefing', '概要案内', 'form16'),
    ('consultation', '導入希望商談', 'form17')
  ) AS c(category, category_label, form_id)
  CROSS JOIN (VALUES ('first'), ('continuous')) AS r(round_type)
  CROSS JOIN (VALUES ('proline'), ('manual')) AS s(source)
),
templates AS (
  SELECT
    'customer' AS recipient,
    category,
    round_type,
    source,
    trigger,
    form_id,
    category_label,
    CASE trigger
      WHEN 'confirm_no_url' THEN category_label || ' 予約確定（URLなし）'
      WHEN 'change_no_url' THEN category_label || ' 予約変更（URLなし）'
      WHEN 'remind_day_before_no_url' THEN category_label || ' 前日リマインド（URLなし）'
      ELSE category_label || ' 1時間前リマインド（URLなし）'
    END AS label,
    CASE trigger
      WHEN 'confirm_no_url' THEN
        '{{companyName}} 様' || E'\n\n' ||
        category_label || 'の予定を以下の日時で予約いたしました。' || E'\n\n' ||
        '日時: {{scheduledAt}}' || E'\n' ||
        '担当: {{staffName}}' || E'\n\n' ||
        'Zoom URLは準備でき次第、改めてお送りいたします。'
      WHEN 'change_no_url' THEN
        '{{companyName}} 様' || E'\n\n' ||
        category_label || 'の予定日時が変更されました。' || E'\n\n' ||
        '変更後日時: {{scheduledAt}}' || E'\n' ||
        '担当: {{staffName}}' || E'\n\n' ||
        'Zoom URLは準備でき次第、改めてお送りいたします。'
      WHEN 'remind_day_before_no_url' THEN
        '{{companyName}} 様' || E'\n\n' ||
        '明日は' || category_label || 'の予定です。' || E'\n\n' ||
        '日時: {{scheduledAt}}' || E'\n\n' ||
        'Zoom URLは準備でき次第、改めてお送りいたします。'
      ELSE
        '{{companyName}} 様' || E'\n\n' ||
        'まもなく' || category_label || 'の予定時刻です。' || E'\n\n' ||
        '日時: {{scheduledAt}}' || E'\n\n' ||
        'Zoom URLはただいま確認中です。準備でき次第、改めてお送りいたします。'
    END AS body
  FROM combos
  CROSS JOIN (VALUES
    ('confirm_no_url'),
    ('change_no_url'),
    ('remind_day_before_no_url'),
    ('remind_hour_before_no_url')
  ) AS t(trigger)
)
INSERT INTO "slp_notification_templates"
  ("recipient", "category", "round_type", "source", "trigger", "form_id", "label", "body", "is_active", "created_at", "updated_at")
SELECT
  recipient, category, round_type, source, trigger, form_id, label, body, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM templates
ON CONFLICT ("recipient", "category", "round_type", "source", "trigger") DO NOTHING;
