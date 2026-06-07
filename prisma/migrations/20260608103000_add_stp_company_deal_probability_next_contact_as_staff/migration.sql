-- AlterTable
ALTER TABLE "stp_companies"
  ADD COLUMN "deal_probability" INTEGER,
  ADD COLUMN "next_contact_date" DATE,
  ADD COLUMN "as_staff_id" INTEGER;

-- CreateIndex
CREATE INDEX "idx_stp_companies_as_staff_id" ON "stp_companies"("as_staff_id");

-- AddForeignKey
ALTER TABLE "stp_companies" ADD CONSTRAINT "stp_companies_as_staff_id_fkey" FOREIGN KEY ("as_staff_id") REFERENCES "master_staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;
