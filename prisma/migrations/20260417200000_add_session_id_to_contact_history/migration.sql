-- ============================================
-- SLP 接触履歴に session_id カラム追加
-- - Zoom議事録由来の接触履歴は対応する打ち合わせ(SlpMeetingSession)に自動紐付け
-- - スタッフが手動で作成した接触履歴も打ち合わせに紐付け可能（任意）
-- ============================================

ALTER TABLE "slp_contact_histories"
  ADD COLUMN "session_id" INTEGER;

CREATE INDEX "slp_contact_histories_session_id_idx"
  ON "slp_contact_histories" ("session_id");

ALTER TABLE "slp_contact_histories"
  ADD CONSTRAINT "slp_contact_histories_session_id_fkey"
  FOREIGN KEY ("session_id") REFERENCES "slp_meeting_sessions"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
