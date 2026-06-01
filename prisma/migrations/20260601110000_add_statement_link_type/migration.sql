ALTER TABLE "bank_statement_entry_group_links"
  ADD COLUMN "link_type" VARCHAR(20) NOT NULL DEFAULT 'settlement';

ALTER TABLE "bank_statement_entry_group_links"
  ADD CONSTRAINT "bank_statement_entry_group_links_link_type_check"
  CHECK ("link_type" IN ('settlement', 'fee'));
