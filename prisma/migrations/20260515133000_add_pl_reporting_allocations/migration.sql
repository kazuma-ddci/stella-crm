-- P/L reporting foundations:
-- - fiscal closing month on operating companies
-- - operating company link on journal entries
-- - frozen P/L allocation rows per journal entry line
-- - operating company scoped monthly close logs

ALTER TABLE "operating_companies"
ADD COLUMN "fiscal_closing_month" INTEGER NOT NULL DEFAULT 3;

ALTER TABLE "JournalEntry"
ADD COLUMN "operatingCompanyId" INTEGER;

ALTER TABLE "MonthlyCloseLog"
ADD COLUMN "operating_company_id" INTEGER;

CREATE TABLE "journal_entry_line_pl_allocations" (
    "id" SERIAL NOT NULL,
    "journalEntryLineId" INTEGER NOT NULL,
    "operatingCompanyId" INTEGER NOT NULL,
    "projectId" INTEGER,
    "costCenterId" INTEGER,
    "allocationTemplateId" INTEGER,
    "allocation_mode" TEXT NOT NULL DEFAULT 'direct',
    "allocation_rate" DECIMAL(65,30),
    "amount_excluding_tax" INTEGER NOT NULL,
    "tax_amount" INTEGER NOT NULL DEFAULT 0,
    "amount_including_tax" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "journal_entry_line_pl_allocations_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "JournalEntry_operatingCompanyId_idx" ON "JournalEntry"("operatingCompanyId");
CREATE INDEX "MonthlyCloseLog_operating_company_id_targetMonth_idx" ON "MonthlyCloseLog"("operating_company_id", "targetMonth");
CREATE INDEX "journal_entry_line_pl_allocations_journalEntryLineId_idx" ON "journal_entry_line_pl_allocations"("journalEntryLineId");
CREATE INDEX "journal_entry_line_pl_allocations_operatingCompanyId_idx" ON "journal_entry_line_pl_allocations"("operatingCompanyId");
CREATE INDEX "journal_entry_line_pl_allocations_projectId_idx" ON "journal_entry_line_pl_allocations"("projectId");
CREATE INDEX "journal_entry_line_pl_allocations_costCenterId_idx" ON "journal_entry_line_pl_allocations"("costCenterId");
CREATE INDEX "journal_entry_line_pl_allocations_allocationTemplateId_idx" ON "journal_entry_line_pl_allocations"("allocationTemplateId");

ALTER TABLE "JournalEntry"
ADD CONSTRAINT "JournalEntry_operatingCompanyId_fkey"
FOREIGN KEY ("operatingCompanyId") REFERENCES "operating_companies"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "MonthlyCloseLog"
ADD CONSTRAINT "MonthlyCloseLog_operating_company_id_fkey"
FOREIGN KEY ("operating_company_id") REFERENCES "operating_companies"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "journal_entry_line_pl_allocations"
ADD CONSTRAINT "journal_entry_line_pl_allocations_journalEntryLineId_fkey"
FOREIGN KEY ("journalEntryLineId") REFERENCES "JournalEntryLine"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "journal_entry_line_pl_allocations"
ADD CONSTRAINT "journal_entry_line_pl_allocations_operatingCompanyId_fkey"
FOREIGN KEY ("operatingCompanyId") REFERENCES "operating_companies"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "journal_entry_line_pl_allocations"
ADD CONSTRAINT "journal_entry_line_pl_allocations_projectId_fkey"
FOREIGN KEY ("projectId") REFERENCES "master_projects"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "journal_entry_line_pl_allocations"
ADD CONSTRAINT "journal_entry_line_pl_allocations_costCenterId_fkey"
FOREIGN KEY ("costCenterId") REFERENCES "CostCenter"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "journal_entry_line_pl_allocations"
ADD CONSTRAINT "journal_entry_line_pl_allocations_allocationTemplateId_fkey"
FOREIGN KEY ("allocationTemplateId") REFERENCES "AllocationTemplate"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
