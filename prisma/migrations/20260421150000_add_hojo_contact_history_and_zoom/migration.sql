-- ============================================
-- HOJO接触履歴機能 + Zoom商談録画の追加
-- 顧客種別4種類（ベンダー/BBS/貸金業社/その他）
-- ============================================

-- ============================================
-- 1. 顧客種別マスタ（customer_types）にHOJO用4種類を seed
-- ============================================
INSERT INTO "customer_types" ("project_id", "code", "name", "display_order", "is_active", "created_at", "updated_at")
SELECT mp."id", 'hojo_vendor', 'ベンダー', 1, TRUE, NOW(), NOW()
FROM "master_projects" mp WHERE mp."code" = 'hojo'
ON CONFLICT DO NOTHING;

INSERT INTO "customer_types" ("project_id", "code", "name", "display_order", "is_active", "created_at", "updated_at")
SELECT mp."id", 'hojo_bbs', 'BBS', 2, TRUE, NOW(), NOW()
FROM "master_projects" mp WHERE mp."code" = 'hojo'
ON CONFLICT DO NOTHING;

INSERT INTO "customer_types" ("project_id", "code", "name", "display_order", "is_active", "created_at", "updated_at")
SELECT mp."id", 'hojo_lender', '貸金業社', 3, TRUE, NOW(), NOW()
FROM "master_projects" mp WHERE mp."code" = 'hojo'
ON CONFLICT DO NOTHING;

INSERT INTO "customer_types" ("project_id", "code", "name", "display_order", "is_active", "created_at", "updated_at")
SELECT mp."id", 'hojo_other', 'その他', 4, TRUE, NOW(), NOW()
FROM "master_projects" mp WHERE mp."code" = 'hojo'
ON CONFLICT DO NOTHING;

-- ============================================
-- 2. HOJO接触履歴テーブル本体
-- ============================================
CREATE TABLE "hojo_contact_histories" (
  "id"                    SERIAL         NOT NULL,
  "contact_date"          TIMESTAMP(3)   NOT NULL,
  "contact_method_id"     INTEGER,
  "contact_category_id"   INTEGER,
  "assigned_to"           VARCHAR(500),
  "customer_participants" VARCHAR(500),
  "meeting_minutes"       TEXT,
  "note"                  TEXT,
  "staff_id"              INTEGER,
  "target_type"           VARCHAR(20)    NOT NULL,
  "vendor_id"             INTEGER,
  "bbs_account_id"        INTEGER,
  "lender_account_id"     INTEGER,
  "created_at"            TIMESTAMP(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"            TIMESTAMP(3)   NOT NULL,
  "deleted_at"            TIMESTAMP(3),
  CONSTRAINT "hojo_contact_histories_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "hojo_contact_histories_target_type_deleted_at_idx"     ON "hojo_contact_histories"("target_type", "deleted_at");
CREATE INDEX "hojo_contact_histories_vendor_id_deleted_at_idx"       ON "hojo_contact_histories"("vendor_id", "deleted_at");
CREATE INDEX "hojo_contact_histories_bbs_account_id_deleted_at_idx"  ON "hojo_contact_histories"("bbs_account_id", "deleted_at");
CREATE INDEX "hojo_contact_histories_lender_account_id_deleted_at_idx" ON "hojo_contact_histories"("lender_account_id", "deleted_at");
CREATE INDEX "hojo_contact_histories_contact_date_idx"               ON "hojo_contact_histories"("contact_date");
CREATE INDEX "hojo_contact_histories_contact_method_id_idx"          ON "hojo_contact_histories"("contact_method_id");
CREATE INDEX "hojo_contact_histories_contact_category_id_idx"        ON "hojo_contact_histories"("contact_category_id");
CREATE INDEX "hojo_contact_histories_staff_id_idx"                   ON "hojo_contact_histories"("staff_id");

ALTER TABLE "hojo_contact_histories"
  ADD CONSTRAINT "hojo_contact_histories_contact_method_id_fkey"
  FOREIGN KEY ("contact_method_id") REFERENCES "contact_methods"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "hojo_contact_histories"
  ADD CONSTRAINT "hojo_contact_histories_contact_category_id_fkey"
  FOREIGN KEY ("contact_category_id") REFERENCES "contact_categories"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "hojo_contact_histories"
  ADD CONSTRAINT "hojo_contact_histories_staff_id_fkey"
  FOREIGN KEY ("staff_id") REFERENCES "master_staff"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "hojo_contact_histories"
  ADD CONSTRAINT "hojo_contact_histories_vendor_id_fkey"
  FOREIGN KEY ("vendor_id") REFERENCES "hojo_vendors"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "hojo_contact_histories"
  ADD CONSTRAINT "hojo_contact_histories_bbs_account_id_fkey"
  FOREIGN KEY ("bbs_account_id") REFERENCES "hojo_bbs_accounts"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "hojo_contact_histories"
  ADD CONSTRAINT "hojo_contact_histories_lender_account_id_fkey"
  FOREIGN KEY ("lender_account_id") REFERENCES "hojo_lender_accounts"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- ============================================
-- 3. HOJO接触履歴 × 顧客種別（タグ）
-- ============================================
CREATE TABLE "hojo_contact_history_tags" (
  "contact_history_id" INTEGER       NOT NULL,
  "customer_type_id"   INTEGER       NOT NULL,
  "created_at"         TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "hojo_contact_history_tags_pkey" PRIMARY KEY ("contact_history_id", "customer_type_id")
);

CREATE INDEX "hojo_contact_history_tags_customer_type_id_idx" ON "hojo_contact_history_tags"("customer_type_id");

ALTER TABLE "hojo_contact_history_tags"
  ADD CONSTRAINT "hojo_contact_history_tags_contact_history_id_fkey"
  FOREIGN KEY ("contact_history_id") REFERENCES "hojo_contact_histories"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "hojo_contact_history_tags"
  ADD CONSTRAINT "hojo_contact_history_tags_customer_type_id_fkey"
  FOREIGN KEY ("customer_type_id") REFERENCES "customer_types"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- ============================================
-- 4. HOJO接触履歴 添付ファイル
-- ============================================
CREATE TABLE "hojo_contact_history_files" (
  "id"                 SERIAL         NOT NULL,
  "contact_history_id" INTEGER        NOT NULL,
  "file_path"          VARCHAR(500),
  "file_name"          VARCHAR(200)   NOT NULL,
  "file_size"          INTEGER,
  "mime_type"          VARCHAR(100),
  "url"                VARCHAR(1000),
  "created_at"         TIMESTAMP(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "hojo_contact_history_files_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "hojo_contact_history_files_contact_history_id_idx" ON "hojo_contact_history_files"("contact_history_id");

ALTER TABLE "hojo_contact_history_files"
  ADD CONSTRAINT "hojo_contact_history_files_contact_history_id_fkey"
  FOREIGN KEY ("contact_history_id") REFERENCES "hojo_contact_histories"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================
-- 5. HOJO Zoom録画テーブル
-- ============================================
CREATE TABLE "hojo_zoom_recordings" (
  "id"                             SERIAL         NOT NULL,
  "contact_history_id"             INTEGER        NOT NULL,
  "zoom_meeting_id"                BIGINT         NOT NULL,
  "zoom_meeting_uuid"              VARCHAR(200),
  "host_staff_id"                  INTEGER,
  "join_url"                       VARCHAR(1000)  NOT NULL DEFAULT '',
  "start_url"                      VARCHAR(2000),
  "password"                       VARCHAR(100),
  "scheduled_at"                   TIMESTAMP(3),
  "is_primary"                     BOOLEAN        NOT NULL DEFAULT true,
  "label"                          VARCHAR(100),
  "state"                          VARCHAR(20)    NOT NULL DEFAULT '予定',
  "zoom_api_error"                 TEXT,
  "zoom_api_error_at"              TIMESTAMP(3),
  "recording_start_at"             TIMESTAMP(3),
  "recording_end_at"               TIMESTAMP(3),
  "mp4_path"                       VARCHAR(1000),
  "mp4_size_bytes"                 BIGINT,
  "transcript_path"                VARCHAR(1000),
  "transcript_text"                TEXT,
  "ai_companion_summary"           TEXT,
  "ai_companion_fetched_at"        TIMESTAMP(3),
  "summary_next_steps"             TEXT,
  "chat_log_path"                  VARCHAR(1000),
  "chat_log_text"                  TEXT,
  "chat_fetched_at"                TIMESTAMP(3),
  "participants_json"              TEXT,
  "participants_fetched_at"        TIMESTAMP(3),
  "claude_summary"                 TEXT,
  "claude_summary_generated_at"    TIMESTAMP(3),
  "claude_summary_prompt_snapshot" TEXT,
  "claude_summary_model"           VARCHAR(80),
  "participants_extracted"         TEXT,
  "download_status"                VARCHAR(30)    NOT NULL DEFAULT 'pending',
  "download_error"                 TEXT,
  "zoom_cloud_deleted_at"          TIMESTAMP(3),
  "minutes_appended_at"            TIMESTAMP(3),
  "claude_minutes_appended_at"     TIMESTAMP(3),
  "created_at"                     TIMESTAMP(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"                     TIMESTAMP(3)   NOT NULL,
  "deleted_at"                     TIMESTAMP(3),
  CONSTRAINT "hojo_zoom_recordings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "hojo_zoom_recordings_zoom_meeting_id_key" ON "hojo_zoom_recordings"("zoom_meeting_id");
CREATE INDEX "hojo_zoom_recordings_contact_history_id_idx" ON "hojo_zoom_recordings"("contact_history_id");
CREATE INDEX "hojo_zoom_recordings_state_idx"               ON "hojo_zoom_recordings"("state");
CREATE INDEX "hojo_zoom_recordings_download_status_idx"     ON "hojo_zoom_recordings"("download_status");
CREATE INDEX "hojo_zoom_recordings_created_at_idx"          ON "hojo_zoom_recordings"("created_at");

ALTER TABLE "hojo_zoom_recordings"
  ADD CONSTRAINT "hojo_zoom_recordings_contact_history_id_fkey"
  FOREIGN KEY ("contact_history_id") REFERENCES "hojo_contact_histories"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "hojo_zoom_recordings"
  ADD CONSTRAINT "hojo_zoom_recordings_host_staff_id_fkey"
  FOREIGN KEY ("host_staff_id") REFERENCES "master_staff"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
