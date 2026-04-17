-- ============================================
-- SLP 商談セッション再設計 Phase 1c
-- 旧カラム・旧テーブル削除（セッションテーブルへの完全移行）
-- ============================================

-- 外部キー制約を先に削除
ALTER TABLE "slp_company_records" DROP CONSTRAINT IF EXISTS "slp_company_records_briefing_staff_id_fkey";
ALTER TABLE "slp_company_records" DROP CONSTRAINT IF EXISTS "slp_company_records_consultation_staff_id_fkey";
ALTER TABLE "slp_company_records" DROP CONSTRAINT IF EXISTS "slp_company_records_briefing_zoom_host_staff_id_fkey";
ALTER TABLE "slp_company_records" DROP CONSTRAINT IF EXISTS "slp_company_records_consultation_zoom_host_staff_id_fkey";

-- インデックス削除
DROP INDEX IF EXISTS "slp_company_records_reservation_id_idx";
DROP INDEX IF EXISTS "slp_company_records_consultation_reservation_id_idx";
DROP INDEX IF EXISTS "slp_company_records_briefing_zoom_meeting_id_idx";
DROP INDEX IF EXISTS "slp_company_records_consultation_zoom_meeting_id_idx";

-- SlpCompanyRecord 旧カラム削除
ALTER TABLE "slp_company_records"
  DROP COLUMN IF EXISTS "briefing_status",
  DROP COLUMN IF EXISTS "briefing_booked_at",
  DROP COLUMN IF EXISTS "briefing_date",
  DROP COLUMN IF EXISTS "briefing_staff",
  DROP COLUMN IF EXISTS "briefing_staff_id",
  DROP COLUMN IF EXISTS "briefing_changed_at",
  DROP COLUMN IF EXISTS "briefing_canceled_at",
  DROP COLUMN IF EXISTS "reservation_id",
  DROP COLUMN IF EXISTS "consultation_reservation_id",
  DROP COLUMN IF EXISTS "merged_briefing_reservation_ids",
  DROP COLUMN IF EXISTS "merged_consultation_reservation_ids",
  DROP COLUMN IF EXISTS "consultation_status",
  DROP COLUMN IF EXISTS "consultation_booked_at",
  DROP COLUMN IF EXISTS "consultation_date",
  DROP COLUMN IF EXISTS "consultation_staff",
  DROP COLUMN IF EXISTS "consultation_staff_id",
  DROP COLUMN IF EXISTS "consultation_changed_at",
  DROP COLUMN IF EXISTS "consultation_canceled_at",
  DROP COLUMN IF EXISTS "briefing_zoom_meeting_id",
  DROP COLUMN IF EXISTS "briefing_zoom_join_url",
  DROP COLUMN IF EXISTS "briefing_zoom_start_url",
  DROP COLUMN IF EXISTS "briefing_zoom_password",
  DROP COLUMN IF EXISTS "briefing_zoom_host_staff_id",
  DROP COLUMN IF EXISTS "briefing_zoom_created_at",
  DROP COLUMN IF EXISTS "briefing_zoom_error",
  DROP COLUMN IF EXISTS "briefing_zoom_error_at",
  DROP COLUMN IF EXISTS "briefing_zoom_confirm_sent_at",
  DROP COLUMN IF EXISTS "briefing_zoom_remind_day_sent_at",
  DROP COLUMN IF EXISTS "briefing_zoom_remind_hour_sent_at",
  DROP COLUMN IF EXISTS "consultation_zoom_meeting_id",
  DROP COLUMN IF EXISTS "consultation_zoom_join_url",
  DROP COLUMN IF EXISTS "consultation_zoom_start_url",
  DROP COLUMN IF EXISTS "consultation_zoom_password",
  DROP COLUMN IF EXISTS "consultation_zoom_host_staff_id",
  DROP COLUMN IF EXISTS "consultation_zoom_created_at",
  DROP COLUMN IF EXISTS "consultation_zoom_error",
  DROP COLUMN IF EXISTS "consultation_zoom_error_at",
  DROP COLUMN IF EXISTS "consultation_zoom_confirm_sent_at",
  DROP COLUMN IF EXISTS "consultation_zoom_remind_day_sent_at",
  DROP COLUMN IF EXISTS "consultation_zoom_remind_hour_sent_at";

-- SlpZoomMessageTemplate テーブル削除（SlpNotificationTemplate に統合済み）
DROP TABLE IF EXISTS "slp_zoom_message_templates";
