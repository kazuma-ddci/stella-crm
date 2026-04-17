-- ============================================
-- SLP 商談セッションにプロライン担当者名（生テキスト）を記録
-- - プロラインWebhookから受信した担当者名文字列を保存
-- - assignedStaffId マッピング未登録時に UI で警告表示するために使用
-- ============================================

ALTER TABLE "slp_meeting_sessions"
  ADD COLUMN "proline_staff_name" VARCHAR(200);
