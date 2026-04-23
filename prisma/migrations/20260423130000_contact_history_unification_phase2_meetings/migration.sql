-- ============================================================================
-- 接触履歴統一 Phase 2: 会議関連3テーブル追加
--
-- 1接触に複数のオンライン会議(Zoom/Meet/Teams)を紐付け可能にする構造。
-- 予定段階(meetings) / 実施後データ(meeting_records) / AI要約履歴(summaries) の3層。
--
-- 設計書: docs/plans/contact-history-unification-plan.md §4
-- ============================================================================

-- ============================================
-- 1. contact_history_meetings (会議 本体)
-- ============================================
CREATE TABLE "contact_history_meetings" (
    "id" SERIAL NOT NULL,
    "contact_history_id" INTEGER NOT NULL,
    "provider" VARCHAR(30) NOT NULL,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "label" VARCHAR(100),
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "external_meeting_id" VARCHAR(200),
    "external_meeting_uuid" VARCHAR(200),
    "join_url" VARCHAR(1000),
    "start_url" VARCHAR(2000),
    "passcode" VARCHAR(100),
    "host_staff_id" INTEGER,
    "host_external_account_id" VARCHAR(200),
    "url_source" VARCHAR(20) NOT NULL DEFAULT 'empty',
    "url_set_at" TIMESTAMP(3),
    "api_integration_status" VARCHAR(30) NOT NULL DEFAULT 'no_url_yet',
    "host_url_consistency_confirmed_at" TIMESTAMP(3),
    "scheduled_start_at" TIMESTAMPTZ(6),
    "scheduled_end_at" TIMESTAMPTZ(6),
    "state" VARCHAR(20) NOT NULL DEFAULT '予定',
    "api_error" TEXT,
    "api_error_at" TIMESTAMP(3),
    "provider_metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "contact_history_meetings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "contact_history_meetings_provider_external_meeting_id_key"
    ON "contact_history_meetings"("provider", "external_meeting_id");
CREATE INDEX "contact_history_meetings_contact_history_id_idx"
    ON "contact_history_meetings"("contact_history_id");
CREATE INDEX "contact_history_meetings_state_idx"
    ON "contact_history_meetings"("state");
CREATE INDEX "contact_history_meetings_api_integration_status_idx"
    ON "contact_history_meetings"("api_integration_status");
CREATE INDEX "contact_history_meetings_scheduled_start_at_idx"
    ON "contact_history_meetings"("scheduled_start_at");

ALTER TABLE "contact_history_meetings" ADD CONSTRAINT "contact_history_meetings_contact_history_id_fkey"
    FOREIGN KEY ("contact_history_id") REFERENCES "contact_histories_v2"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "contact_history_meetings" ADD CONSTRAINT "contact_history_meetings_host_staff_id_fkey"
    FOREIGN KEY ("host_staff_id") REFERENCES "master_staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ============================================
-- 2. contact_history_meeting_records (会議記録 = 実施後データ)
-- ============================================
CREATE TABLE "contact_history_meeting_records" (
    "id" SERIAL NOT NULL,
    "meeting_id" INTEGER NOT NULL,
    "recording_start_at" TIMESTAMP(3),
    "recording_end_at" TIMESTAMP(3),
    "recording_url" VARCHAR(1000),
    "recording_path" VARCHAR(1000),
    "recording_size_bytes" BIGINT,
    "transcript_url" VARCHAR(1000),
    "transcript_text" TEXT,
    "chat_log_url" VARCHAR(1000),
    "chat_log_text" TEXT,
    "attendance_json" JSONB,
    "ai_summary" TEXT,
    "ai_summary_source" VARCHAR(30),
    "ai_summary_model" VARCHAR(80),
    "ai_summary_generated_at" TIMESTAMP(3),
    "minutes_appended_at" TIMESTAMP(3),
    "download_status" VARCHAR(30) NOT NULL DEFAULT 'pending',
    "download_error" TEXT,
    "provider_raw_data" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contact_history_meeting_records_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "contact_history_meeting_records_meeting_id_key"
    ON "contact_history_meeting_records"("meeting_id");
CREATE INDEX "contact_history_meeting_records_download_status_idx"
    ON "contact_history_meeting_records"("download_status");
CREATE INDEX "contact_history_meeting_records_ai_summary_generated_at_idx"
    ON "contact_history_meeting_records"("ai_summary_generated_at");

ALTER TABLE "contact_history_meeting_records" ADD CONSTRAINT "contact_history_meeting_records_meeting_id_fkey"
    FOREIGN KEY ("meeting_id") REFERENCES "contact_history_meetings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================
-- 3. meeting_record_summaries (AI要約バージョン履歴)
-- ============================================
CREATE TABLE "meeting_record_summaries" (
    "id" SERIAL NOT NULL,
    "meeting_record_id" INTEGER NOT NULL,
    "version" INTEGER NOT NULL,
    "summary_text" TEXT NOT NULL,
    "source" VARCHAR(30) NOT NULL,
    "model" VARCHAR(80),
    "prompt_snapshot" TEXT,
    "generated_at" TIMESTAMP(3) NOT NULL,
    "generated_by_staff_id" INTEGER,
    "is_current" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "meeting_record_summaries_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "meeting_record_summaries_meeting_record_id_version_key"
    ON "meeting_record_summaries"("meeting_record_id", "version");
CREATE INDEX "meeting_record_summaries_meeting_record_id_is_current_idx"
    ON "meeting_record_summaries"("meeting_record_id", "is_current");

ALTER TABLE "meeting_record_summaries" ADD CONSTRAINT "meeting_record_summaries_meeting_record_id_fkey"
    FOREIGN KEY ("meeting_record_id") REFERENCES "contact_history_meeting_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "meeting_record_summaries" ADD CONSTRAINT "meeting_record_summaries_generated_by_staff_id_fkey"
    FOREIGN KEY ("generated_by_staff_id") REFERENCES "master_staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;
