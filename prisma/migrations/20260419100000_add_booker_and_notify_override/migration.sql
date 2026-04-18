-- 1. SlpCompanyContact に商談通知受信フラグを追加（デフォルトTRUE）
ALTER TABLE "slp_company_contacts"
  ADD COLUMN "receives_session_notifications" BOOLEAN NOT NULL DEFAULT true;

-- 2. SlpMeetingSession に予約者（予約した担当者）を記録
ALTER TABLE "slp_meeting_sessions"
  ADD COLUMN "booker_contact_id" INTEGER;

ALTER TABLE "slp_meeting_sessions"
  ADD CONSTRAINT "slp_meeting_sessions_booker_contact_id_fkey"
  FOREIGN KEY ("booker_contact_id") REFERENCES "slp_company_contacts"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "slp_meeting_sessions_booker_contact_id_idx"
  ON "slp_meeting_sessions"("booker_contact_id");

-- 3. 商談ごとの通知対象 個別設定テーブル
CREATE TABLE "slp_session_notify_contacts" (
  "session_id" INTEGER NOT NULL,
  "contact_id" INTEGER NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "slp_session_notify_contacts_pkey" PRIMARY KEY ("session_id", "contact_id")
);

CREATE INDEX "slp_session_notify_contacts_contact_id_idx"
  ON "slp_session_notify_contacts"("contact_id");

ALTER TABLE "slp_session_notify_contacts"
  ADD CONSTRAINT "slp_session_notify_contacts_session_id_fkey"
  FOREIGN KEY ("session_id") REFERENCES "slp_meeting_sessions"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "slp_session_notify_contacts"
  ADD CONSTRAINT "slp_session_notify_contacts_contact_id_fkey"
  FOREIGN KEY ("contact_id") REFERENCES "slp_company_contacts"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
