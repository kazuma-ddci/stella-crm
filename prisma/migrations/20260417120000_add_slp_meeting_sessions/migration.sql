-- ============================================
-- SLP 商談セッション再設計 Phase 1a
-- 新規テーブル追加 + 既存テーブルへのセッション参照カラム追加
-- 旧カラム削除は Phase 1c で実施（既存コードの段階移行完了後）
-- ============================================

-- ============================================
-- 1. SlpMeetingSession (商談セッション)
-- ============================================
CREATE TABLE "slp_meeting_sessions" (
  "id" SERIAL PRIMARY KEY,
  "company_record_id" INTEGER NOT NULL,
  "category" VARCHAR(20) NOT NULL,
  "round_number" INTEGER NOT NULL,
  "status" VARCHAR(20) NOT NULL,
  "source" VARCHAR(20) NOT NULL,

  "scheduled_at" TIMESTAMP(3),
  "assigned_staff_id" INTEGER,
  "proline_reservation_id" VARCHAR(100),

  "booked_at" TIMESTAMP(3),
  "completed_at" TIMESTAMP(3),
  "cancelled_at" TIMESTAMP(3),
  "no_show_at" TIMESTAMP(3),
  "cancel_reason" TEXT,
  "no_show_reason" TEXT,

  "notes" TEXT,

  "created_by_staff_id" INTEGER,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  "deleted_at" TIMESTAMP(3)
);

CREATE INDEX "slp_meeting_sessions_company_record_id_category_round_number_idx"
  ON "slp_meeting_sessions" ("company_record_id", "category", "round_number");
CREATE INDEX "slp_meeting_sessions_company_record_id_category_status_idx"
  ON "slp_meeting_sessions" ("company_record_id", "category", "status");
CREATE INDEX "slp_meeting_sessions_proline_reservation_id_idx"
  ON "slp_meeting_sessions" ("proline_reservation_id");
CREATE INDEX "slp_meeting_sessions_scheduled_at_idx"
  ON "slp_meeting_sessions" ("scheduled_at");

ALTER TABLE "slp_meeting_sessions"
  ADD CONSTRAINT "slp_meeting_sessions_company_record_id_fkey"
  FOREIGN KEY ("company_record_id") REFERENCES "slp_company_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "slp_meeting_sessions"
  ADD CONSTRAINT "slp_meeting_sessions_assigned_staff_id_fkey"
  FOREIGN KEY ("assigned_staff_id") REFERENCES "master_staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "slp_meeting_sessions"
  ADD CONSTRAINT "slp_meeting_sessions_created_by_staff_id_fkey"
  FOREIGN KEY ("created_by_staff_id") REFERENCES "master_staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ============================================
-- 2. SlpMeetingSessionZoom (セッション毎の複数Zoom記録)
-- ============================================
CREATE TABLE "slp_meeting_session_zooms" (
  "id" SERIAL PRIMARY KEY,
  "session_id" INTEGER NOT NULL,

  "zoom_meeting_id" BIGINT NOT NULL,
  "zoom_meeting_uuid" VARCHAR(200),
  "join_url" VARCHAR(1000) NOT NULL,
  "start_url" VARCHAR(2000),
  "password" VARCHAR(100),
  "host_staff_id" INTEGER,
  "scheduled_at" TIMESTAMP(3),

  "is_primary" BOOLEAN NOT NULL DEFAULT true,
  "label" VARCHAR(100),

  "confirm_sent_at" TIMESTAMP(3),
  "remind_day_sent_at" TIMESTAMP(3),
  "remind_hour_sent_at" TIMESTAMP(3),

  "zoom_error" TEXT,
  "zoom_error_at" TIMESTAMP(3),

  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  "deleted_at" TIMESTAMP(3)
);

CREATE INDEX "slp_meeting_session_zooms_session_id_idx"
  ON "slp_meeting_session_zooms" ("session_id");
CREATE INDEX "slp_meeting_session_zooms_zoom_meeting_id_idx"
  ON "slp_meeting_session_zooms" ("zoom_meeting_id");

ALTER TABLE "slp_meeting_session_zooms"
  ADD CONSTRAINT "slp_meeting_session_zooms_session_id_fkey"
  FOREIGN KEY ("session_id") REFERENCES "slp_meeting_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "slp_meeting_session_zooms"
  ADD CONSTRAINT "slp_meeting_session_zooms_host_staff_id_fkey"
  FOREIGN KEY ("host_staff_id") REFERENCES "master_staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ============================================
-- 3. SlpMeetingSessionHistory (変更履歴)
-- ============================================
CREATE TABLE "slp_meeting_session_histories" (
  "id" SERIAL PRIMARY KEY,
  "session_id" INTEGER NOT NULL,

  "changed_by_staff_id" INTEGER,
  "change_type" VARCHAR(30) NOT NULL,
  "field_name" VARCHAR(100),
  "old_value" TEXT,
  "new_value" TEXT,
  "reason" TEXT,

  "changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "slp_meeting_session_histories_session_id_changed_at_idx"
  ON "slp_meeting_session_histories" ("session_id", "changed_at" DESC);

ALTER TABLE "slp_meeting_session_histories"
  ADD CONSTRAINT "slp_meeting_session_histories_session_id_fkey"
  FOREIGN KEY ("session_id") REFERENCES "slp_meeting_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "slp_meeting_session_histories"
  ADD CONSTRAINT "slp_meeting_session_histories_changed_by_staff_id_fkey"
  FOREIGN KEY ("changed_by_staff_id") REFERENCES "master_staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ============================================
-- 4. SlpNotificationTemplate (通知テンプレート統合)
-- ============================================
CREATE TABLE "slp_notification_templates" (
  "id" SERIAL PRIMARY KEY,

  "recipient" VARCHAR(20) NOT NULL,
  "category" VARCHAR(20) NOT NULL,
  "round_type" VARCHAR(20),
  "source" VARCHAR(20),
  "trigger" VARCHAR(40) NOT NULL,

  "form_id" VARCHAR(20) NOT NULL,
  "label" VARCHAR(200) NOT NULL,
  "body" TEXT NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT true,

  "updated_by_staff_id" INTEGER,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL
);

-- NULL を含むユニーク制約（Postgres は NULL を distinct 扱いにするので注意）
-- 代わりに NULLS NOT DISTINCT 指定でユニークにする
CREATE UNIQUE INDEX "slp_notification_templates_recipient_category_round_type_source_trigger_key"
  ON "slp_notification_templates" ("recipient", "category", "round_type", "source", "trigger")
  NULLS NOT DISTINCT;

CREATE INDEX "slp_notification_templates_recipient_category_idx"
  ON "slp_notification_templates" ("recipient", "category");

ALTER TABLE "slp_notification_templates"
  ADD CONSTRAINT "slp_notification_templates_updated_by_staff_id_fkey"
  FOREIGN KEY ("updated_by_staff_id") REFERENCES "master_staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ============================================
-- 5. 既存テーブルへのセッション参照カラム追加
-- ============================================

-- 5-1. slp_reservation_history
ALTER TABLE "slp_reservation_history"
  ADD COLUMN "session_id" INTEGER,
  ADD COLUMN "round_number" INTEGER;

CREATE INDEX "slp_reservation_history_session_id_idx"
  ON "slp_reservation_history" ("session_id");

ALTER TABLE "slp_reservation_history"
  ADD CONSTRAINT "slp_reservation_history_session_id_fkey"
  FOREIGN KEY ("session_id") REFERENCES "slp_meeting_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 5-2. slp_zoom_send_logs
ALTER TABLE "slp_zoom_send_logs"
  ADD COLUMN "session_id" INTEGER,
  ADD COLUMN "recipient" VARCHAR(20);

CREATE INDEX "slp_zoom_send_logs_session_id_idx"
  ON "slp_zoom_send_logs" ("session_id");

ALTER TABLE "slp_zoom_send_logs"
  ADD CONSTRAINT "slp_zoom_send_logs_session_id_fkey"
  FOREIGN KEY ("session_id") REFERENCES "slp_meeting_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 5-3. slp_zoom_recordings
ALTER TABLE "slp_zoom_recordings"
  ADD COLUMN "session_zoom_id" INTEGER;

CREATE INDEX "slp_zoom_recordings_session_zoom_id_idx"
  ON "slp_zoom_recordings" ("session_zoom_id");

ALTER TABLE "slp_zoom_recordings"
  ADD CONSTRAINT "slp_zoom_recordings_session_zoom_id_fkey"
  FOREIGN KEY ("session_zoom_id") REFERENCES "slp_meeting_session_zooms"("id") ON DELETE SET NULL ON UPDATE CASCADE;
