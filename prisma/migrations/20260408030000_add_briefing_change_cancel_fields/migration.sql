-- AlterTable
ALTER TABLE "slp_company_records"
  ADD COLUMN "proline_uid" VARCHAR(100),
  ADD COLUMN "briefing_changed_at" TIMESTAMP(3),
  ADD COLUMN "briefing_canceled_at" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "slp_company_records_proline_uid_idx" ON "slp_company_records"("proline_uid");
