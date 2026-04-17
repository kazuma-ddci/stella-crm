-- ============================================
-- SLP Zoom記録スキーマ再構成
--
-- - SlpZoomRecording に SlpMeetingSessionZoom のカラムを吸収
-- - ContactHistory : ZoomRecording を 1:1 から 1:N へ
-- - state カラム（"予定"/"取得中"/"完了"/"失敗"）追加
-- - minutesAppendedAt カラム追加（議事録テキスト追記の二重防止）
-- - SlpMeetingSessionZoom テーブル廃止
-- ============================================

-- 1. SlpMeetingSessionZoom の FK制約を外す（ZoomRecording 側）
ALTER TABLE "slp_zoom_recordings"
  DROP CONSTRAINT IF EXISTS "slp_zoom_recordings_session_zoom_id_fkey";

-- 2. ZoomRecording.contactHistoryId UNIQUE制約を削除（1:N化）
ALTER TABLE "slp_zoom_recordings"
  DROP CONSTRAINT IF EXISTS "slp_zoom_recordings_contact_history_id_key";

-- 3. 不要になった sessionZoomId カラム + インデックスを削除
DROP INDEX IF EXISTS "slp_zoom_recordings_session_zoom_id_idx";
ALTER TABLE "slp_zoom_recordings"
  DROP COLUMN IF EXISTS "session_zoom_id";

-- 4. SlpZoomRecording にカラム追加（旧SessionZoomから吸収）
ALTER TABLE "slp_zoom_recordings"
  ADD COLUMN "join_url" VARCHAR(1000) NOT NULL DEFAULT '',
  ADD COLUMN "start_url" VARCHAR(2000),
  ADD COLUMN "password" VARCHAR(100),
  ADD COLUMN "scheduled_at" TIMESTAMP(3),
  ADD COLUMN "is_primary" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "label" VARCHAR(100),
  ADD COLUMN "state" VARCHAR(20) NOT NULL DEFAULT '予定',
  ADD COLUMN "confirm_sent_at" TIMESTAMP(3),
  ADD COLUMN "remind_day_sent_at" TIMESTAMP(3),
  ADD COLUMN "remind_hour_sent_at" TIMESTAMP(3),
  ADD COLUMN "zoom_api_error" TEXT,
  ADD COLUMN "zoom_api_error_at" TIMESTAMP(3),
  ADD COLUMN "minutes_appended_at" TIMESTAMP(3),
  ADD COLUMN "deleted_at" TIMESTAMP(3);

-- 5. 新しいインデックスを作成
CREATE INDEX "slp_zoom_recordings_contact_history_id_idx"
  ON "slp_zoom_recordings"("contact_history_id");

CREATE INDEX "slp_zoom_recordings_state_idx"
  ON "slp_zoom_recordings"("state");

-- 6. SlpMeetingSessionZoom テーブルを削除
DROP TABLE IF EXISTS "slp_meeting_session_zooms";
