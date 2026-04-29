-- ContactHistoryMeeting に通知送信フラグを追加。
-- V1 (slp_zoom_recordings) の confirm_sent_at / remind_day_sent_at / remind_hour_sent_at を
-- V2 階層 (contact_history_meetings) に持ち上げ、リマインダー cron / 予約確定通知の二重送信防止に使う。

ALTER TABLE "contact_history_meetings"
  ADD COLUMN IF NOT EXISTS "confirm_sent_at"      TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "reminder_day_sent_at"  TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "reminder_hour_sent_at" TIMESTAMP(3);

-- リマインダー cron 用に、対象会議を絞り込むインデックス
CREATE INDEX IF NOT EXISTS "idx_contact_history_meetings_reminder_day"
  ON "contact_history_meetings" ("scheduled_start_at")
  WHERE "deleted_at" IS NULL AND "reminder_day_sent_at" IS NULL;

CREATE INDEX IF NOT EXISTS "idx_contact_history_meetings_reminder_hour"
  ON "contact_history_meetings" ("scheduled_start_at")
  WHERE "deleted_at" IS NULL AND "reminder_hour_sent_at" IS NULL;
