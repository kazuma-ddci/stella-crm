-- ============================================
-- Zoom連携機能のためのスキーマ追加
-- 1. staff_meeting_integrations: スタッフのZoom OAuthトークン保存
-- 2. slp_zoom_message_templates: 予約通知・リマインドの文面テンプレ
-- 3. slp_zoom_ai_prompt_templates: Claude要約・抽出プロンプト
-- 4. slp_zoom_send_logs: プロライン送信履歴
-- 5. slp_zoom_recordings: 録画メタ情報（mp4/vtt/要約）
-- 加えて slp_company_records にZoom関連22カラム追加
-- ============================================

-- 1. staff_meeting_integrations
CREATE TABLE "staff_meeting_integrations" (
  "id" SERIAL PRIMARY KEY,
  "staff_id" INTEGER NOT NULL,
  "provider" VARCHAR(30) NOT NULL,
  "external_user_id" VARCHAR(200) NOT NULL,
  "external_email" VARCHAR(255),
  "external_display_name" VARCHAR(200),
  "refresh_token_enc" TEXT NOT NULL,
  "access_token_enc" TEXT,
  "access_token_expires_at" TIMESTAMP(3),
  "scope" TEXT,
  "connected_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "last_refreshed_at" TIMESTAMP(3),
  "disconnected_at" TIMESTAMP(3),
  "disconnected_by_staff_id" INTEGER,
  CONSTRAINT "staff_meeting_integrations_staff_id_fkey"
    FOREIGN KEY ("staff_id") REFERENCES "master_staff"("id") ON DELETE CASCADE,
  CONSTRAINT "staff_meeting_integrations_disconnected_by_staff_id_fkey"
    FOREIGN KEY ("disconnected_by_staff_id") REFERENCES "master_staff"("id")
);

CREATE UNIQUE INDEX "staff_meeting_integrations_staff_id_provider_key"
  ON "staff_meeting_integrations"("staff_id", "provider");
CREATE INDEX "staff_meeting_integrations_provider_idx"
  ON "staff_meeting_integrations"("provider");
CREATE INDEX "staff_meeting_integrations_disconnected_at_idx"
  ON "staff_meeting_integrations"("disconnected_at");

-- 2. slp_zoom_message_templates
CREATE TABLE "slp_zoom_message_templates" (
  "id" SERIAL PRIMARY KEY,
  "template_key" VARCHAR(100) NOT NULL,
  "category" VARCHAR(30) NOT NULL,
  "trigger" VARCHAR(30) NOT NULL,
  "label" VARCHAR(200) NOT NULL,
  "body" TEXT NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "updated_by_staff_id" INTEGER,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "slp_zoom_message_templates_updated_by_staff_id_fkey"
    FOREIGN KEY ("updated_by_staff_id") REFERENCES "master_staff"("id")
);

CREATE UNIQUE INDEX "slp_zoom_message_templates_template_key_key"
  ON "slp_zoom_message_templates"("template_key");
CREATE INDEX "slp_zoom_message_templates_category_trigger_idx"
  ON "slp_zoom_message_templates"("category", "trigger");

-- 3. slp_zoom_ai_prompt_templates
CREATE TABLE "slp_zoom_ai_prompt_templates" (
  "id" SERIAL PRIMARY KEY,
  "template_key" VARCHAR(100) NOT NULL,
  "label" VARCHAR(200) NOT NULL,
  "prompt_body" TEXT NOT NULL,
  "model" VARCHAR(80) NOT NULL DEFAULT 'claude-sonnet-4-6',
  "max_tokens" INTEGER NOT NULL DEFAULT 8192,
  "updated_by_staff_id" INTEGER,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "slp_zoom_ai_prompt_templates_updated_by_staff_id_fkey"
    FOREIGN KEY ("updated_by_staff_id") REFERENCES "master_staff"("id")
);

CREATE UNIQUE INDEX "slp_zoom_ai_prompt_templates_template_key_key"
  ON "slp_zoom_ai_prompt_templates"("template_key");

-- 4. slp_zoom_send_logs
CREATE TABLE "slp_zoom_send_logs" (
  "id" SERIAL PRIMARY KEY,
  "company_record_id" INTEGER NOT NULL,
  "category" VARCHAR(30) NOT NULL,
  "trigger" VARCHAR(50) NOT NULL,
  "uid" VARCHAR(100) NOT NULL,
  "form_id" VARCHAR(100) NOT NULL,
  "field_key" VARCHAR(50) NOT NULL,
  "body_text" TEXT NOT NULL,
  "status" VARCHAR(30) NOT NULL,
  "error_message" TEXT,
  "http_status" INTEGER,
  "sent_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "slp_zoom_send_logs_company_record_id_fkey"
    FOREIGN KEY ("company_record_id") REFERENCES "slp_company_records"("id") ON DELETE CASCADE
);

CREATE INDEX "slp_zoom_send_logs_company_record_id_idx"
  ON "slp_zoom_send_logs"("company_record_id");
CREATE INDEX "slp_zoom_send_logs_sent_at_idx"
  ON "slp_zoom_send_logs"("sent_at");
CREATE INDEX "slp_zoom_send_logs_status_idx"
  ON "slp_zoom_send_logs"("status");

-- 5. slp_zoom_recordings
CREATE TABLE "slp_zoom_recordings" (
  "id" SERIAL PRIMARY KEY,
  "contact_history_id" INTEGER NOT NULL,
  "zoom_meeting_id" BIGINT NOT NULL,
  "zoom_meeting_uuid" VARCHAR(200),
  "category" VARCHAR(30) NOT NULL,
  "host_staff_id" INTEGER,
  "recording_start_at" TIMESTAMP(3),
  "recording_end_at" TIMESTAMP(3),
  "mp4_path" VARCHAR(1000),
  "mp4_size_bytes" BIGINT,
  "transcript_path" VARCHAR(1000),
  "transcript_text" TEXT,
  "ai_companion_summary" TEXT,
  "ai_companion_fetched_at" TIMESTAMP(3),
  "claude_summary" TEXT,
  "claude_summary_generated_at" TIMESTAMP(3),
  "claude_summary_prompt_snapshot" TEXT,
  "claude_summary_model" VARCHAR(80),
  "participants_extracted" TEXT,
  "download_status" VARCHAR(30) NOT NULL DEFAULT 'pending',
  "download_error" TEXT,
  "zoom_cloud_deleted_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "slp_zoom_recordings_contact_history_id_fkey"
    FOREIGN KEY ("contact_history_id") REFERENCES "slp_contact_histories"("id") ON DELETE CASCADE,
  CONSTRAINT "slp_zoom_recordings_host_staff_id_fkey"
    FOREIGN KEY ("host_staff_id") REFERENCES "master_staff"("id")
);

CREATE UNIQUE INDEX "slp_zoom_recordings_contact_history_id_key"
  ON "slp_zoom_recordings"("contact_history_id");
CREATE INDEX "slp_zoom_recordings_zoom_meeting_id_idx"
  ON "slp_zoom_recordings"("zoom_meeting_id");
CREATE INDEX "slp_zoom_recordings_download_status_idx"
  ON "slp_zoom_recordings"("download_status");
CREATE INDEX "slp_zoom_recordings_created_at_idx"
  ON "slp_zoom_recordings"("created_at");

-- 6. slp_company_records にZoomカラム追加
ALTER TABLE "slp_company_records"
  ADD COLUMN "briefing_zoom_meeting_id" BIGINT,
  ADD COLUMN "briefing_zoom_join_url" VARCHAR(1000),
  ADD COLUMN "briefing_zoom_start_url" VARCHAR(2000),
  ADD COLUMN "briefing_zoom_password" VARCHAR(100),
  ADD COLUMN "briefing_zoom_host_staff_id" INTEGER,
  ADD COLUMN "briefing_zoom_created_at" TIMESTAMP(3),
  ADD COLUMN "briefing_zoom_error" TEXT,
  ADD COLUMN "briefing_zoom_error_at" TIMESTAMP(3),
  ADD COLUMN "briefing_zoom_confirm_sent_at" TIMESTAMP(3),
  ADD COLUMN "briefing_zoom_remind_day_sent_at" TIMESTAMP(3),
  ADD COLUMN "briefing_zoom_remind_hour_sent_at" TIMESTAMP(3),
  ADD COLUMN "consultation_zoom_meeting_id" BIGINT,
  ADD COLUMN "consultation_zoom_join_url" VARCHAR(1000),
  ADD COLUMN "consultation_zoom_start_url" VARCHAR(2000),
  ADD COLUMN "consultation_zoom_password" VARCHAR(100),
  ADD COLUMN "consultation_zoom_host_staff_id" INTEGER,
  ADD COLUMN "consultation_zoom_created_at" TIMESTAMP(3),
  ADD COLUMN "consultation_zoom_error" TEXT,
  ADD COLUMN "consultation_zoom_error_at" TIMESTAMP(3),
  ADD COLUMN "consultation_zoom_confirm_sent_at" TIMESTAMP(3),
  ADD COLUMN "consultation_zoom_remind_day_sent_at" TIMESTAMP(3),
  ADD COLUMN "consultation_zoom_remind_hour_sent_at" TIMESTAMP(3);

ALTER TABLE "slp_company_records"
  ADD CONSTRAINT "slp_company_records_briefing_zoom_host_staff_id_fkey"
    FOREIGN KEY ("briefing_zoom_host_staff_id") REFERENCES "master_staff"("id"),
  ADD CONSTRAINT "slp_company_records_consultation_zoom_host_staff_id_fkey"
    FOREIGN KEY ("consultation_zoom_host_staff_id") REFERENCES "master_staff"("id");

CREATE INDEX "slp_company_records_briefing_zoom_meeting_id_idx"
  ON "slp_company_records"("briefing_zoom_meeting_id");
CREATE INDEX "slp_company_records_consultation_zoom_meeting_id_idx"
  ON "slp_company_records"("consultation_zoom_meeting_id");

-- 7. 初期テンプレート投入（後でCRMから編集可能）
INSERT INTO "slp_zoom_message_templates" ("template_key", "category", "trigger", "label", "body", "updated_at") VALUES
  ('briefing_confirm', 'briefing', 'confirm', '概要案内 予約確定通知', E'{{事業者名}}様、概要案内のご予約ありがとうございます。\n日時: {{日時}}\n担当: {{担当者}}\nZoom URL: {{url}}', CURRENT_TIMESTAMP),
  ('briefing_change', 'briefing', 'change', '概要案内 予約変更通知', E'{{事業者名}}様、概要案内のご予約内容が変更されました。\n新しい日時: {{日時}}\n担当: {{担当者}}\nZoom URL: {{url}}', CURRENT_TIMESTAMP),
  ('briefing_remind_day_before', 'briefing', 'remind_day_before', '概要案内 前日リマインド', E'【前日リマインド】{{事業者名}}様、明日{{日時}}に概要案内を予定しております。\nZoom URL: {{url}}', CURRENT_TIMESTAMP),
  ('briefing_remind_hour_before', 'briefing', 'remind_hour_before', '概要案内 1時間前リマインド', E'【まもなく開始】{{事業者名}}様、{{日時}}より概要案内を開始いたします。\nZoom URL: {{url}}', CURRENT_TIMESTAMP),
  ('briefing_regenerated_manual_notice', 'briefing', 'regenerated_manual_notice', '概要案内 再発行直後の手動送付用', E'{{事業者名}}様、Zoom URLが再発行されました。新しいURLでご参加ください。\n日時: {{日時}}\nZoom URL: {{url}}', CURRENT_TIMESTAMP),
  ('consultation_confirm', 'consultation', 'confirm', '導入希望商談 予約確定通知', E'{{事業者名}}様、導入希望商談のご予約ありがとうございます。\n日時: {{日時}}\n担当: {{担当者}}\nZoom URL: {{url}}', CURRENT_TIMESTAMP),
  ('consultation_change', 'consultation', 'change', '導入希望商談 予約変更通知', E'{{事業者名}}様、導入希望商談のご予約内容が変更されました。\n新しい日時: {{日時}}\n担当: {{担当者}}\nZoom URL: {{url}}', CURRENT_TIMESTAMP),
  ('consultation_remind_day_before', 'consultation', 'remind_day_before', '導入希望商談 前日リマインド', E'【前日リマインド】{{事業者名}}様、明日{{日時}}に導入希望商談を予定しております。\nZoom URL: {{url}}', CURRENT_TIMESTAMP),
  ('consultation_remind_hour_before', 'consultation', 'remind_hour_before', '導入希望商談 1時間前リマインド', E'【まもなく開始】{{事業者名}}様、{{日時}}より導入希望商談を開始いたします。\nZoom URL: {{url}}', CURRENT_TIMESTAMP),
  ('consultation_regenerated_manual_notice', 'consultation', 'regenerated_manual_notice', '導入希望商談 再発行直後の手動送付用', E'{{事業者名}}様、Zoom URLが再発行されました。新しいURLでご参加ください。\n日時: {{日時}}\nZoom URL: {{url}}', CURRENT_TIMESTAMP);

-- 8. AIプロンプト初期投入
INSERT INTO "slp_zoom_ai_prompt_templates" ("template_key", "label", "prompt_body", "model", "max_tokens", "updated_at") VALUES
  ('summary', '議事録要約', E'あなたは商談議事録を整形する日本語アシスタントです。以下の文字起こしから、簡潔で読みやすい議事録を作成してください。\n\n出力フォーマット:\n【商談種別】{{商談種別}}\n【事業者名】{{事業者名}}\n【日時】{{日時}}\n【担当】{{担当者}}\n\n■ 主要論点（箇条書き3-7項目）\n■ 決定事項\n■ ToDo・次アクション\n■ 備考\n\n口語は要約時に整え、文字起こし特有の言い淀みは除去してください。ただし情報を捏造せず、不明瞭な部分は「要確認」と明示してください。', 'claude-sonnet-4-6', 8192, CURRENT_TIMESTAMP),
  ('participants_extract', '先方参加者抽出', E'以下の商談文字起こしから、先方（お客様側）の参加者名だけをJSON配列で抽出してください。弊社スタッフは除外します。\n弊社スタッフ名: {{弊社スタッフ一覧}}\n\n出力フォーマット: {"participants": ["山田太郎", "..."]}\n名前が判別できない場合は空配列を返してください。敬称（様・さん）は除いた氏名のみで。', 'claude-haiku-4-5-20251001', 512, CURRENT_TIMESTAMP),
  ('thankyou_briefing', 'お礼メッセージ（概要案内）', E'あなたは丁寧でビジネスライクな日本語メッセージを作成するアシスタントです。以下の商談内容を踏まえて、お客様向けのお礼メッセージを作成してください。\n\n【事業者名】{{事業者名}}\n【商談内容要約】{{要約}}\n\n要件:\n- 200字程度\n- LINE送信を想定した自然な文体\n- 議事録の内容を踏まえて具体的に\n- 次アクションがあれば1行で触れる', 'claude-haiku-4-5-20251001', 1024, CURRENT_TIMESTAMP),
  ('thankyou_consultation', 'お礼メッセージ（導入希望商談）', E'あなたは丁寧でビジネスライクな日本語メッセージを作成するアシスタントです。以下の導入希望商談の内容を踏まえて、お客様向けのお礼メッセージを作成してください。\n\n【事業者名】{{事業者名}}\n【商談内容要約】{{要約}}\n\n要件:\n- 250字程度\n- LINE送信を想定した自然な文体\n- 導入へ向けた次のステップを明確に\n- ご不明点があれば気軽にお問合せいただけるよう締める', 'claude-haiku-4-5-20251001', 1024, CURRENT_TIMESTAMP);

-- 9. 接触種別マスタに「概要案内」「導入希望商談」を追加（存在しない場合のみ）
-- SLPプロジェクトに紐付く
INSERT INTO "contact_categories" ("project_id", "name", "display_order", "is_active", "created_at", "updated_at")
SELECT mp."id", '概要案内', 100, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "master_projects" mp
WHERE mp."code" = 'slp'
  AND NOT EXISTS (
    SELECT 1 FROM "contact_categories" cc
    WHERE cc."project_id" = mp."id" AND cc."name" = '概要案内'
  );

INSERT INTO "contact_categories" ("project_id", "name", "display_order", "is_active", "created_at", "updated_at")
SELECT mp."id", '導入希望商談', 101, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "master_projects" mp
WHERE mp."code" = 'slp'
  AND NOT EXISTS (
    SELECT 1 FROM "contact_categories" cc
    WHERE cc."project_id" = mp."id" AND cc."name" = '導入希望商談'
  );
