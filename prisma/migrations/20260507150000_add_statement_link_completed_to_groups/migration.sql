-- Add the workflow flag read by /accounting/workflow.
-- Idempotent because stg may already have been repaired manually.

ALTER TABLE "InvoiceGroup"
  ADD COLUMN IF NOT EXISTS "statement_link_completed" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "PaymentGroup"
  ADD COLUMN IF NOT EXISTS "statement_link_completed" BOOLEAN NOT NULL DEFAULT false;
