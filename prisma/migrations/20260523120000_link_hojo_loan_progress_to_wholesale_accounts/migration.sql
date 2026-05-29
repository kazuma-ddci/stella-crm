-- Link HOJO loan progress records to security-cloud wholesale customer rows.
ALTER TABLE "hojo_wholesale_accounts"
  ADD COLUMN "applicant_type" VARCHAR(20);

ALTER TABLE "hojo_loan_progresses"
  ALTER COLUMN "formSubmissionId" DROP NOT NULL,
  ADD COLUMN "wholesale_account_id" INTEGER,
  ADD COLUMN "form_token" VARCHAR(64),
  ADD COLUMN "form_update_status" VARCHAR(20) NOT NULL DEFAULT '未送信',
  ADD COLUMN "pending_form_type" VARCHAR(100),
  ADD COLUMN "pending_answers" JSONB,
  ADD COLUMN "loan_usage_approved" VARCHAR(10),
  ADD COLUMN "loan_usage_pending" VARCHAR(10),
  ADD COLUMN "loan_usage_change_requested_at" TIMESTAMP(3);

CREATE UNIQUE INDEX "hojo_loan_progresses_wholesale_account_id_key"
  ON "hojo_loan_progresses"("wholesale_account_id");

CREATE UNIQUE INDEX "hojo_loan_progresses_form_token_key"
  ON "hojo_loan_progresses"("form_token");

CREATE INDEX "hojo_loan_progresses_form_update_status_idx"
  ON "hojo_loan_progresses"("form_update_status");

CREATE INDEX "hojo_loan_progresses_loan_usage_pending_idx"
  ON "hojo_loan_progresses"("loan_usage_pending");

ALTER TABLE "hojo_loan_progresses"
  ADD CONSTRAINT "hojo_loan_progresses_wholesale_account_id_fkey"
  FOREIGN KEY ("wholesale_account_id") REFERENCES "hojo_wholesale_accounts"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

UPDATE "hojo_loan_progresses"
SET "form_update_status" = '送信済み'
WHERE "formSubmissionId" IS NOT NULL;
