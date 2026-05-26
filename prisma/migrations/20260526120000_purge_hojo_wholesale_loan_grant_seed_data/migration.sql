-- One-time cleanup for the Hojo wholesale customer-list redesign.
-- Keep vendors, lenders, BBS accounts, statuses, and other masters intact.
-- Remove the old operational data so new loan/grant records are generated only
-- from hojo_wholesale_accounts rows created after this migration.

DELETE FROM "hojo_loan_progresses";

DELETE FROM "hojo_application_supports";

DELETE FROM "hojo_form_submissions"
WHERE "formType" IN ('loan-corporate', 'loan-individual', 'business-plan');

DELETE FROM "hojo_wholesale_accounts";

ALTER SEQUENCE IF EXISTS "hojo_loan_progresses_id_seq" RESTART WITH 1;
ALTER SEQUENCE IF EXISTS "hojo_application_supports_id_seq" RESTART WITH 1;
ALTER SEQUENCE IF EXISTS "hojo_wholesale_accounts_id_seq" RESTART WITH 1;
