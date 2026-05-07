-- Create bank statement import tables before receipt/payment record_source backfill.
-- This migration is intentionally idempotent because stg was repaired manually
-- after the missing tables blocked 20260430180000_add_receipt_payment_record_source.

CREATE TABLE IF NOT EXISTS "bank_statement_imports" (
    "id" SERIAL NOT NULL,
    "operatingCompanyId" INTEGER NOT NULL,
    "operatingCompanyBankAccountId" INTEGER NOT NULL,
    "bankFormatId" VARCHAR(40) NOT NULL,
    "fileName" VARCHAR(255) NOT NULL,
    "uploadedBy" INTEGER NOT NULL,
    "rowCount" INTEGER NOT NULL DEFAULT 0,
    "insertedCount" INTEGER NOT NULL DEFAULT 0,
    "duplicateCount" INTEGER NOT NULL DEFAULT 0,
    "openingBalance" INTEGER,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bank_statement_imports_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "bank_statement_entries" (
    "id" SERIAL NOT NULL,
    "importId" INTEGER NOT NULL,
    "operatingCompanyId" INTEGER NOT NULL,
    "operatingCompanyBankAccountId" INTEGER NOT NULL,
    "transactionDate" TIMESTAMP(3) NOT NULL,
    "description" TEXT NOT NULL,
    "incomingAmount" INTEGER,
    "outgoingAmount" INTEGER,
    "balance" INTEGER,
    "csvMemo" TEXT,
    "staffMemo" TEXT,
    "rowOrder" INTEGER NOT NULL,
    "dedupHash" VARCHAR(64) NOT NULL,
    "excluded" BOOLEAN NOT NULL DEFAULT false,
    "excludedReason" VARCHAR(40),
    "excludedNote" TEXT,
    "excludedAt" TIMESTAMP(3),
    "excludedBy" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bank_statement_entries_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "bank_statement_entry_group_links" (
    "id" SERIAL NOT NULL,
    "bankStatementEntryId" INTEGER NOT NULL,
    "invoiceGroupId" INTEGER,
    "paymentGroupId" INTEGER,
    "amount" INTEGER NOT NULL,
    "note" TEXT,
    "createdBy" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bank_statement_entry_group_links_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "bank_statement_imports_operatingCompanyId_importedAt_idx"
    ON "bank_statement_imports"("operatingCompanyId", "importedAt");

CREATE INDEX IF NOT EXISTS "bank_statement_imports_operatingCompanyBankAccountId_import_idx"
    ON "bank_statement_imports"("operatingCompanyBankAccountId", "importedAt");

CREATE UNIQUE INDEX IF NOT EXISTS "bank_statement_entries_operatingCompanyBankAccountId_dedupH_key"
    ON "bank_statement_entries"("operatingCompanyBankAccountId", "dedupHash");

CREATE INDEX IF NOT EXISTS "bank_statement_entries_operatingCompanyBankAccountId_transa_idx"
    ON "bank_statement_entries"("operatingCompanyBankAccountId", "transactionDate");

CREATE INDEX IF NOT EXISTS "bank_statement_entries_operatingCompanyId_transactionDate_idx"
    ON "bank_statement_entries"("operatingCompanyId", "transactionDate");

CREATE INDEX IF NOT EXISTS "bank_statement_entries_importId_idx"
    ON "bank_statement_entries"("importId");

CREATE INDEX IF NOT EXISTS "bank_statement_entry_group_links_bankStatementEntryId_idx"
    ON "bank_statement_entry_group_links"("bankStatementEntryId");

CREATE INDEX IF NOT EXISTS "bank_statement_entry_group_links_invoiceGroupId_idx"
    ON "bank_statement_entry_group_links"("invoiceGroupId");

CREATE INDEX IF NOT EXISTS "bank_statement_entry_group_links_paymentGroupId_idx"
    ON "bank_statement_entry_group_links"("paymentGroupId");

ALTER TABLE "invoice_group_receipts"
    ADD COLUMN IF NOT EXISTS "bank_statement_entry_group_link_id" INTEGER;

ALTER TABLE "payment_group_payments"
    ADD COLUMN IF NOT EXISTS "bank_statement_entry_group_link_id" INTEGER;

CREATE UNIQUE INDEX IF NOT EXISTS "invoice_group_receipts_bank_statement_entry_group_link_id_key"
    ON "invoice_group_receipts"("bank_statement_entry_group_link_id");

CREATE UNIQUE INDEX IF NOT EXISTS "payment_group_payments_bank_statement_entry_group_link_id_key"
    ON "payment_group_payments"("bank_statement_entry_group_link_id");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'bank_statement_imports_operatingCompanyId_fkey'
    ) THEN
        ALTER TABLE "bank_statement_imports"
            ADD CONSTRAINT "bank_statement_imports_operatingCompanyId_fkey"
            FOREIGN KEY ("operatingCompanyId") REFERENCES "operating_companies"("id")
            ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'bank_statement_imports_operatingCompanyBankAccountId_fkey'
    ) THEN
        ALTER TABLE "bank_statement_imports"
            ADD CONSTRAINT "bank_statement_imports_operatingCompanyBankAccountId_fkey"
            FOREIGN KEY ("operatingCompanyBankAccountId") REFERENCES "operating_company_bank_accounts"("id")
            ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'bank_statement_imports_uploadedBy_fkey'
    ) THEN
        ALTER TABLE "bank_statement_imports"
            ADD CONSTRAINT "bank_statement_imports_uploadedBy_fkey"
            FOREIGN KEY ("uploadedBy") REFERENCES "master_staff"("id")
            ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'bank_statement_entries_importId_fkey'
    ) THEN
        ALTER TABLE "bank_statement_entries"
            ADD CONSTRAINT "bank_statement_entries_importId_fkey"
            FOREIGN KEY ("importId") REFERENCES "bank_statement_imports"("id")
            ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'bank_statement_entries_operatingCompanyId_fkey'
    ) THEN
        ALTER TABLE "bank_statement_entries"
            ADD CONSTRAINT "bank_statement_entries_operatingCompanyId_fkey"
            FOREIGN KEY ("operatingCompanyId") REFERENCES "operating_companies"("id")
            ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'bank_statement_entries_operatingCompanyBankAccountId_fkey'
    ) THEN
        ALTER TABLE "bank_statement_entries"
            ADD CONSTRAINT "bank_statement_entries_operatingCompanyBankAccountId_fkey"
            FOREIGN KEY ("operatingCompanyBankAccountId") REFERENCES "operating_company_bank_accounts"("id")
            ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'bank_statement_entries_excludedBy_fkey'
    ) THEN
        ALTER TABLE "bank_statement_entries"
            ADD CONSTRAINT "bank_statement_entries_excludedBy_fkey"
            FOREIGN KEY ("excludedBy") REFERENCES "master_staff"("id")
            ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'bank_statement_entry_group_links_bankStatementEntryId_fkey'
    ) THEN
        ALTER TABLE "bank_statement_entry_group_links"
            ADD CONSTRAINT "bank_statement_entry_group_links_bankStatementEntryId_fkey"
            FOREIGN KEY ("bankStatementEntryId") REFERENCES "bank_statement_entries"("id")
            ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'bank_statement_entry_group_links_invoiceGroupId_fkey'
    ) THEN
        ALTER TABLE "bank_statement_entry_group_links"
            ADD CONSTRAINT "bank_statement_entry_group_links_invoiceGroupId_fkey"
            FOREIGN KEY ("invoiceGroupId") REFERENCES "InvoiceGroup"("id")
            ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'bank_statement_entry_group_links_paymentGroupId_fkey'
    ) THEN
        ALTER TABLE "bank_statement_entry_group_links"
            ADD CONSTRAINT "bank_statement_entry_group_links_paymentGroupId_fkey"
            FOREIGN KEY ("paymentGroupId") REFERENCES "PaymentGroup"("id")
            ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'bank_statement_entry_group_links_createdBy_fkey'
    ) THEN
        ALTER TABLE "bank_statement_entry_group_links"
            ADD CONSTRAINT "bank_statement_entry_group_links_createdBy_fkey"
            FOREIGN KEY ("createdBy") REFERENCES "master_staff"("id")
            ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'invoice_group_receipts_bank_statement_entry_group_link_id_fkey'
    ) THEN
        ALTER TABLE "invoice_group_receipts"
            ADD CONSTRAINT "invoice_group_receipts_bank_statement_entry_group_link_id_fkey"
            FOREIGN KEY ("bank_statement_entry_group_link_id") REFERENCES "bank_statement_entry_group_links"("id")
            ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'payment_group_payments_bank_statement_entry_group_link_id_fkey'
    ) THEN
        ALTER TABLE "payment_group_payments"
            ADD CONSTRAINT "payment_group_payments_bank_statement_entry_group_link_id_fkey"
            FOREIGN KEY ("bank_statement_entry_group_link_id") REFERENCES "bank_statement_entry_group_links"("id")
            ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
