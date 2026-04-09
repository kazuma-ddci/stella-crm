-- AlterTable
ALTER TABLE "slp_company_records" ADD COLUMN "briefing_staff_id" INTEGER;

-- AddForeignKey
ALTER TABLE "slp_company_records" ADD CONSTRAINT "slp_company_records_briefing_staff_id_fkey" FOREIGN KEY ("briefing_staff_id") REFERENCES "master_staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;
