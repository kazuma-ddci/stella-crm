-- ============================================================================
-- 接触履歴統一 Phase 1: コア5テーブル追加
--
-- 旧 contact_histories / slp_contact_histories / hojo_contact_histories は残したまま
-- 新テーブルを並行稼働させる。_v2 サフィックスは Phase 7 で旧テーブル削除後に外す。
--
-- 設計書: docs/plans/contact-history-unification-plan.md
-- ============================================================================

-- ============================================
-- 1. contact_histories_v2 (接触履歴 本体)
-- ============================================
CREATE TABLE "contact_histories_v2" (
    "id" SERIAL NOT NULL,
    "project_id" INTEGER NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'scheduled',
    "title" VARCHAR(200),
    "scheduled_start_at" TIMESTAMPTZ(6) NOT NULL,
    "scheduled_end_at" TIMESTAMPTZ(6),
    "actual_start_at" TIMESTAMPTZ(6),
    "actual_end_at" TIMESTAMPTZ(6),
    "display_timezone" VARCHAR(50) NOT NULL DEFAULT 'Asia/Tokyo',
    "contact_method_id" INTEGER,
    "contact_category_id" INTEGER,
    "meeting_minutes" TEXT,
    "note" TEXT,
    "source_type" VARCHAR(30),
    "source_ref_id" VARCHAR(200),
    "rescheduled_from_at" TIMESTAMPTZ(6),
    "rescheduled_count" INTEGER NOT NULL DEFAULT 0,
    "rescheduled_reason" TEXT,
    "cancelled_at" TIMESTAMPTZ(6),
    "cancelled_reason" TEXT,
    "recurring_series_id" VARCHAR(100),
    "parent_contact_history_id" INTEGER,
    "created_by_staff_id" INTEGER,
    "updated_by_staff_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "contact_histories_v2_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "contact_histories_v2_project_id_status_idx" ON "contact_histories_v2"("project_id", "status");
CREATE INDEX "contact_histories_v2_scheduled_start_at_idx" ON "contact_histories_v2"("scheduled_start_at");
CREATE INDEX "contact_histories_v2_status_scheduled_start_at_idx" ON "contact_histories_v2"("status", "scheduled_start_at");
CREATE INDEX "contact_histories_v2_contact_category_id_idx" ON "contact_histories_v2"("contact_category_id");
CREATE INDEX "contact_histories_v2_contact_method_id_idx" ON "contact_histories_v2"("contact_method_id");
CREATE INDEX "contact_histories_v2_created_by_staff_id_idx" ON "contact_histories_v2"("created_by_staff_id");
CREATE INDEX "contact_histories_v2_deleted_at_idx" ON "contact_histories_v2"("deleted_at");
CREATE INDEX "contact_histories_v2_recurring_series_id_idx" ON "contact_histories_v2"("recurring_series_id");
CREATE INDEX "contact_histories_v2_parent_contact_history_id_idx" ON "contact_histories_v2"("parent_contact_history_id");

ALTER TABLE "contact_histories_v2" ADD CONSTRAINT "contact_histories_v2_project_id_fkey"
    FOREIGN KEY ("project_id") REFERENCES "master_projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "contact_histories_v2" ADD CONSTRAINT "contact_histories_v2_contact_method_id_fkey"
    FOREIGN KEY ("contact_method_id") REFERENCES "contact_methods"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "contact_histories_v2" ADD CONSTRAINT "contact_histories_v2_contact_category_id_fkey"
    FOREIGN KEY ("contact_category_id") REFERENCES "contact_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "contact_histories_v2" ADD CONSTRAINT "contact_histories_v2_parent_contact_history_id_fkey"
    FOREIGN KEY ("parent_contact_history_id") REFERENCES "contact_histories_v2"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "contact_histories_v2" ADD CONSTRAINT "contact_histories_v2_created_by_staff_id_fkey"
    FOREIGN KEY ("created_by_staff_id") REFERENCES "master_staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "contact_histories_v2" ADD CONSTRAINT "contact_histories_v2_updated_by_staff_id_fkey"
    FOREIGN KEY ("updated_by_staff_id") REFERENCES "master_staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ============================================
-- 2. contact_customer_participants (顧客側参加エンティティ)
-- ============================================
CREATE TABLE "contact_customer_participants" (
    "id" SERIAL NOT NULL,
    "contact_history_id" INTEGER NOT NULL,
    "target_type" VARCHAR(30) NOT NULL,
    "target_id" INTEGER,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contact_customer_participants_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "contact_customer_participants_contact_history_id_target_type_target_id_key"
    ON "contact_customer_participants"("contact_history_id", "target_type", "target_id");
CREATE INDEX "contact_customer_participants_contact_history_id_idx"
    ON "contact_customer_participants"("contact_history_id");
CREATE INDEX "contact_customer_participants_target_type_target_id_idx"
    ON "contact_customer_participants"("target_type", "target_id");

ALTER TABLE "contact_customer_participants" ADD CONSTRAINT "contact_customer_participants_contact_history_id_fkey"
    FOREIGN KEY ("contact_history_id") REFERENCES "contact_histories_v2"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================
-- 3. contact_customer_attendees (先方参加者 個人)
-- ============================================
CREATE TABLE "contact_customer_attendees" (
    "id" SERIAL NOT NULL,
    "customer_participant_id" INTEGER NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "title" VARCHAR(100),
    "source_type" VARCHAR(30) NOT NULL DEFAULT 'manual',
    "source_id" INTEGER,
    "saved_to_master" BOOLEAN NOT NULL DEFAULT false,
    "attended" BOOLEAN,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contact_customer_attendees_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "contact_customer_attendees_customer_participant_id_idx"
    ON "contact_customer_attendees"("customer_participant_id");
CREATE INDEX "contact_customer_attendees_source_type_source_id_idx"
    ON "contact_customer_attendees"("source_type", "source_id");

ALTER TABLE "contact_customer_attendees" ADD CONSTRAINT "contact_customer_attendees_customer_participant_id_fkey"
    FOREIGN KEY ("customer_participant_id") REFERENCES "contact_customer_participants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================
-- 4. contact_staff_participants (弊社スタッフ参加者)
-- ============================================
CREATE TABLE "contact_staff_participants" (
    "id" SERIAL NOT NULL,
    "contact_history_id" INTEGER NOT NULL,
    "staff_id" INTEGER NOT NULL,
    "is_host" BOOLEAN NOT NULL DEFAULT false,
    "attended" BOOLEAN,
    "google_calendar_event_id" VARCHAR(200),
    "google_calendar_synced_at" TIMESTAMP(3),
    "google_calendar_sync_error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contact_staff_participants_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "contact_staff_participants_contact_history_id_staff_id_key"
    ON "contact_staff_participants"("contact_history_id", "staff_id");
CREATE INDEX "contact_staff_participants_staff_id_idx"
    ON "contact_staff_participants"("staff_id");

ALTER TABLE "contact_staff_participants" ADD CONSTRAINT "contact_staff_participants_contact_history_id_fkey"
    FOREIGN KEY ("contact_history_id") REFERENCES "contact_histories_v2"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "contact_staff_participants" ADD CONSTRAINT "contact_staff_participants_staff_id_fkey"
    FOREIGN KEY ("staff_id") REFERENCES "master_staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ============================================
-- 5. contact_history_files_v2 (添付ファイル)
-- ============================================
CREATE TABLE "contact_history_files_v2" (
    "id" SERIAL NOT NULL,
    "contact_history_id" INTEGER NOT NULL,
    "file_path" VARCHAR(500),
    "file_name" VARCHAR(200) NOT NULL,
    "file_size" INTEGER,
    "mime_type" VARCHAR(100),
    "url" VARCHAR(1000),
    "uploaded_by_staff_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contact_history_files_v2_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "contact_history_files_v2_contact_history_id_idx"
    ON "contact_history_files_v2"("contact_history_id");

ALTER TABLE "contact_history_files_v2" ADD CONSTRAINT "contact_history_files_v2_contact_history_id_fkey"
    FOREIGN KEY ("contact_history_id") REFERENCES "contact_histories_v2"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "contact_history_files_v2" ADD CONSTRAINT "contact_history_files_v2_uploaded_by_staff_id_fkey"
    FOREIGN KEY ("uploaded_by_staff_id") REFERENCES "master_staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;
