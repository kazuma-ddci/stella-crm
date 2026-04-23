-- ============================================================================
-- 接触履歴統一 Phase 3 + 4: 通知・外部連携・スタッフOAuth 計9テーブル追加
--
-- Phase 3 (5テーブル): 通知・カレンダー連携・リトライキュー
-- Phase 4 (4テーブル): スタッフOAuth (Google/Zoom/Slack/Telegram)
--
-- 設計書: docs/plans/contact-history-unification-plan.md §6, §7
-- ============================================================================

-- ============================================
-- Phase 3-1: contact_history_notifications
-- ============================================
CREATE TABLE "contact_history_notifications" (
    "id" SERIAL NOT NULL,
    "contact_history_id" INTEGER NOT NULL,
    "type" VARCHAR(30) NOT NULL,
    "channel" VARCHAR(30) NOT NULL,
    "recipient_staff_id" INTEGER,
    "recipient_external_id" VARCHAR(200),
    "scheduled_at" TIMESTAMP(3) NOT NULL,
    "sent_at" TIMESTAMP(3),
    "status" VARCHAR(30) NOT NULL DEFAULT 'pending',
    "error" TEXT,
    "external_message_id" VARCHAR(200),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contact_history_notifications_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "contact_history_notifications_contact_history_id_idx" ON "contact_history_notifications"("contact_history_id");
CREATE INDEX "contact_history_notifications_status_scheduled_at_idx" ON "contact_history_notifications"("status", "scheduled_at");
CREATE INDEX "contact_history_notifications_recipient_staff_id_idx" ON "contact_history_notifications"("recipient_staff_id");

ALTER TABLE "contact_history_notifications" ADD CONSTRAINT "contact_history_notifications_contact_history_id_fkey"
    FOREIGN KEY ("contact_history_id") REFERENCES "contact_histories_v2"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "contact_history_notifications" ADD CONSTRAINT "contact_history_notifications_recipient_staff_id_fkey"
    FOREIGN KEY ("recipient_staff_id") REFERENCES "master_staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ============================================
-- Phase 3-2: contact_history_external_events
-- ============================================
CREATE TABLE "contact_history_external_events" (
    "id" SERIAL NOT NULL,
    "contact_history_id" INTEGER NOT NULL,
    "provider" VARCHAR(30) NOT NULL,
    "external_event_id" VARCHAR(200) NOT NULL,
    "external_calendar_id" VARCHAR(200),
    "sync_direction" VARCHAR(20) NOT NULL,
    "last_synced_at" TIMESTAMP(3),
    "sync_status" VARCHAR(30) NOT NULL DEFAULT 'pending',
    "sync_error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contact_history_external_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "contact_history_external_events_provider_external_event_id_key"
    ON "contact_history_external_events"("provider", "external_event_id");
CREATE INDEX "contact_history_external_events_contact_history_id_idx" ON "contact_history_external_events"("contact_history_id");
CREATE INDEX "contact_history_external_events_provider_sync_status_idx" ON "contact_history_external_events"("provider", "sync_status");

ALTER TABLE "contact_history_external_events" ADD CONSTRAINT "contact_history_external_events_contact_history_id_fkey"
    FOREIGN KEY ("contact_history_id") REFERENCES "contact_histories_v2"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================
-- Phase 3-3: calendar_project_mapping
-- ============================================
CREATE TABLE "calendar_project_mapping" (
    "id" SERIAL NOT NULL,
    "google_calendar_id" VARCHAR(200) NOT NULL,
    "calendar_display_name" VARCHAR(200),
    "owner_staff_id" INTEGER,
    "project_id" INTEGER NOT NULL,
    "default_contact_category_id" INTEGER,
    "title_keyword" VARCHAR(100),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by_staff_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "calendar_project_mapping_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "calendar_project_mapping_google_calendar_id_title_keyword_key"
    ON "calendar_project_mapping"("google_calendar_id", "title_keyword");
CREATE INDEX "calendar_project_mapping_project_id_idx" ON "calendar_project_mapping"("project_id");
CREATE INDEX "calendar_project_mapping_owner_staff_id_idx" ON "calendar_project_mapping"("owner_staff_id");
CREATE INDEX "calendar_project_mapping_is_active_idx" ON "calendar_project_mapping"("is_active");

ALTER TABLE "calendar_project_mapping" ADD CONSTRAINT "calendar_project_mapping_project_id_fkey"
    FOREIGN KEY ("project_id") REFERENCES "master_projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "calendar_project_mapping" ADD CONSTRAINT "calendar_project_mapping_owner_staff_id_fkey"
    FOREIGN KEY ("owner_staff_id") REFERENCES "master_staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "calendar_project_mapping" ADD CONSTRAINT "calendar_project_mapping_created_by_staff_id_fkey"
    FOREIGN KEY ("created_by_staff_id") REFERENCES "master_staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "calendar_project_mapping" ADD CONSTRAINT "calendar_project_mapping_default_contact_category_id_fkey"
    FOREIGN KEY ("default_contact_category_id") REFERENCES "contact_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ============================================
-- Phase 3-4: google_calendar_subscriptions
-- ============================================
CREATE TABLE "google_calendar_subscriptions" (
    "id" SERIAL NOT NULL,
    "google_calendar_id" VARCHAR(200) NOT NULL,
    "channel_id" VARCHAR(200) NOT NULL,
    "resource_id" VARCHAR(200) NOT NULL,
    "expiration" TIMESTAMP(3) NOT NULL,
    "sync_token" VARCHAR(500),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "google_calendar_subscriptions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "google_calendar_subscriptions_channel_id_key" ON "google_calendar_subscriptions"("channel_id");
CREATE INDEX "google_calendar_subscriptions_google_calendar_id_idx" ON "google_calendar_subscriptions"("google_calendar_id");
CREATE INDEX "google_calendar_subscriptions_is_active_expiration_idx" ON "google_calendar_subscriptions"("is_active", "expiration");

-- ============================================
-- Phase 3-5: contact_history_sync_queue
-- ============================================
CREATE TABLE "contact_history_sync_queue" (
    "id" SERIAL NOT NULL,
    "contact_history_id" INTEGER,
    "meeting_id" INTEGER,
    "job_type" VARCHAR(50) NOT NULL,
    "payload" JSONB,
    "status" VARCHAR(30) NOT NULL DEFAULT 'pending',
    "attempt_count" INTEGER NOT NULL DEFAULT 0,
    "max_attempts" INTEGER NOT NULL DEFAULT 5,
    "next_attempt_at" TIMESTAMP(3),
    "last_error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contact_history_sync_queue_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "contact_history_sync_queue_status_next_attempt_at_idx" ON "contact_history_sync_queue"("status", "next_attempt_at");
CREATE INDEX "contact_history_sync_queue_contact_history_id_idx" ON "contact_history_sync_queue"("contact_history_id");
CREATE INDEX "contact_history_sync_queue_meeting_id_idx" ON "contact_history_sync_queue"("meeting_id");

ALTER TABLE "contact_history_sync_queue" ADD CONSTRAINT "contact_history_sync_queue_contact_history_id_fkey"
    FOREIGN KEY ("contact_history_id") REFERENCES "contact_histories_v2"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "contact_history_sync_queue" ADD CONSTRAINT "contact_history_sync_queue_meeting_id_fkey"
    FOREIGN KEY ("meeting_id") REFERENCES "contact_history_meetings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================
-- Phase 4-1: staff_google_auth
-- ============================================
CREATE TABLE "staff_google_auth" (
    "id" SERIAL NOT NULL,
    "staff_id" INTEGER NOT NULL,
    "google_account_id" VARCHAR(200) NOT NULL,
    "google_email" VARCHAR(255),
    "access_token" TEXT NOT NULL,
    "refresh_token" TEXT NOT NULL,
    "scope" VARCHAR(1000) NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "primary_calendar_id" VARCHAR(200),
    "linked_at" TIMESTAMP(3) NOT NULL,
    "last_refreshed_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "staff_google_auth_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "staff_google_auth_staff_id_key" ON "staff_google_auth"("staff_id");

ALTER TABLE "staff_google_auth" ADD CONSTRAINT "staff_google_auth_staff_id_fkey"
    FOREIGN KEY ("staff_id") REFERENCES "master_staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================
-- Phase 4-2: staff_zoom_auth
-- ============================================
CREATE TABLE "staff_zoom_auth" (
    "id" SERIAL NOT NULL,
    "staff_id" INTEGER NOT NULL,
    "zoom_user_id" VARCHAR(200) NOT NULL,
    "zoom_email" VARCHAR(255),
    "access_token" TEXT NOT NULL,
    "refresh_token" TEXT NOT NULL,
    "scope" VARCHAR(1000) NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "linked_at" TIMESTAMP(3) NOT NULL,
    "last_refreshed_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "staff_zoom_auth_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "staff_zoom_auth_staff_id_key" ON "staff_zoom_auth"("staff_id");

ALTER TABLE "staff_zoom_auth" ADD CONSTRAINT "staff_zoom_auth_staff_id_fkey"
    FOREIGN KEY ("staff_id") REFERENCES "master_staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================
-- Phase 4-3: staff_slack_link
-- ============================================
CREATE TABLE "staff_slack_link" (
    "id" SERIAL NOT NULL,
    "staff_id" INTEGER NOT NULL,
    "slack_user_id" VARCHAR(50) NOT NULL,
    "slack_team_id" VARCHAR(50) NOT NULL,
    "slack_display_name" VARCHAR(200),
    "slack_email" VARCHAR(255),
    "linked_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "staff_slack_link_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "staff_slack_link_staff_id_key" ON "staff_slack_link"("staff_id");
CREATE UNIQUE INDEX "staff_slack_link_slack_user_id_key" ON "staff_slack_link"("slack_user_id");

ALTER TABLE "staff_slack_link" ADD CONSTRAINT "staff_slack_link_staff_id_fkey"
    FOREIGN KEY ("staff_id") REFERENCES "master_staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================
-- Phase 4-4: staff_telegram_link
-- ============================================
CREATE TABLE "staff_telegram_link" (
    "id" SERIAL NOT NULL,
    "staff_id" INTEGER NOT NULL,
    "telegram_user_id" BIGINT NOT NULL,
    "telegram_username" VARCHAR(200),
    "telegram_chat_id" BIGINT,
    "linked_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "staff_telegram_link_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "staff_telegram_link_staff_id_key" ON "staff_telegram_link"("staff_id");
CREATE UNIQUE INDEX "staff_telegram_link_telegram_user_id_key" ON "staff_telegram_link"("telegram_user_id");

ALTER TABLE "staff_telegram_link" ADD CONSTRAINT "staff_telegram_link_staff_id_fkey"
    FOREIGN KEY ("staff_id") REFERENCES "master_staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;
