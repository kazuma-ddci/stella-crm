-- ============================================
-- 接触履歴の添付に外部URL対応を追加（STP・SLP両方）
-- ============================================

-- STP: contact_history_files
ALTER TABLE "contact_history_files" ADD COLUMN "url" VARCHAR(1000);
ALTER TABLE "contact_history_files" ALTER COLUMN "file_path" DROP NOT NULL;
ALTER TABLE "contact_history_files" ALTER COLUMN "file_size" DROP NOT NULL;
ALTER TABLE "contact_history_files" ALTER COLUMN "mime_type" DROP NOT NULL;

-- SLP: slp_contact_history_files
ALTER TABLE "slp_contact_history_files" ADD COLUMN "url" VARCHAR(1000);
ALTER TABLE "slp_contact_history_files" ALTER COLUMN "file_path" DROP NOT NULL;
ALTER TABLE "slp_contact_history_files" ALTER COLUMN "file_size" DROP NOT NULL;
ALTER TABLE "slp_contact_history_files" ALTER COLUMN "mime_type" DROP NOT NULL;
