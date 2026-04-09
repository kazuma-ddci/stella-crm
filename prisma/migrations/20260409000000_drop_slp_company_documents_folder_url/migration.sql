-- ============================================
-- 企業名簿: 必要書類格納URL カラムを削除
-- 提出書類機能（slp_company_documents）で代替されたため
-- ============================================

ALTER TABLE "slp_company_records" DROP COLUMN IF EXISTS "documents_folder_url";
