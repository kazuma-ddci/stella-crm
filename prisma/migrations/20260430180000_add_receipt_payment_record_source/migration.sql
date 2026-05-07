ALTER TABLE "invoice_group_receipts"
  ADD COLUMN "record_source" TEXT NOT NULL DEFAULT 'manual';

ALTER TABLE "payment_group_payments"
  ADD COLUMN "record_source" TEXT NOT NULL DEFAULT 'manual';

UPDATE "invoice_group_receipts" r
SET "record_source" = 'bank_statement'
FROM "bank_statement_entry_group_links" l
WHERE r."bank_statement_entry_group_link_id" = l."id"
  AND r."created_at" >= l."createdAt";

UPDATE "payment_group_payments" p
SET "record_source" = 'bank_statement'
FROM "bank_statement_entry_group_links" l
WHERE p."bank_statement_entry_group_link_id" = l."id"
  AND p."created_at" >= l."createdAt";
