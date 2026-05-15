-- Add an internal P/L exclusion flag to accounting groups.
-- Statutory P/L must continue to include all journal entries.

ALTER TABLE "InvoiceGroup"
  ADD COLUMN IF NOT EXISTS "exclude_from_internal_pl" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "PaymentGroup"
  ADD COLUMN IF NOT EXISTS "exclude_from_internal_pl" BOOLEAN NOT NULL DEFAULT false;
