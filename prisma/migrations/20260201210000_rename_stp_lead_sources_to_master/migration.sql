-- Rename table
ALTER TABLE "stp_lead_sources" RENAME TO "master_stp_lead_sources";

-- Rename foreign key constraint
ALTER TABLE "stp_companies" DROP CONSTRAINT IF EXISTS "stp_companies_leadSourceId_fkey";
ALTER TABLE "stp_companies" ADD CONSTRAINT "stp_companies_leadSourceId_fkey" FOREIGN KEY ("leadSourceId") REFERENCES "master_stp_lead_sources"("id") ON DELETE SET NULL ON UPDATE CASCADE;
