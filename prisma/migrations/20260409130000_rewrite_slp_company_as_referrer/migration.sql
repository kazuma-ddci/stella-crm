-- DropForeignKey
ALTER TABLE "slp_company_records" DROP CONSTRAINT IF EXISTS "slp_company_records_as_staff_id_fkey";

-- DropIndex
DROP INDEX IF EXISTS "slp_company_records_as_staff_id_idx";

-- AlterTable: SlpCompanyRecord から asStaffId, referrerText を削除
ALTER TABLE "slp_company_records" DROP COLUMN IF EXISTS "as_staff_id";
ALTER TABLE "slp_company_records" DROP COLUMN IF EXISTS "referrer_text";

-- AlterTable: SlpCompanyContact に手動上書き4フィールドを追加
ALTER TABLE "slp_company_contacts" ADD COLUMN "manual_as_id" INTEGER;
ALTER TABLE "slp_company_contacts" ADD COLUMN "manual_as_reason" TEXT;
ALTER TABLE "slp_company_contacts" ADD COLUMN "manual_as_changed_at" TIMESTAMP(3);
ALTER TABLE "slp_company_contacts" ADD COLUMN "manual_as_changed_by_id" INTEGER;

-- AddForeignKey
ALTER TABLE "slp_company_contacts" ADD CONSTRAINT "slp_company_contacts_manual_as_id_fkey" FOREIGN KEY ("manual_as_id") REFERENCES "slp_as"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "slp_company_contacts" ADD CONSTRAINT "slp_company_contacts_manual_as_changed_by_id_fkey" FOREIGN KEY ("manual_as_changed_by_id") REFERENCES "master_staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;
