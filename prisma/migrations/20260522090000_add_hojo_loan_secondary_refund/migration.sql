ALTER TABLE "hojo_loan_progresses"
  ADD COLUMN "secondary_repayment_date" TIMESTAMP(3),
  ADD COLUMN "secondary_repayment_amount" DECIMAL(14,0),
  ADD COLUMN "secondary_principal_amount" DECIMAL(14,0),
  ADD COLUMN "secondary_interest_amount" DECIMAL(14,0),
  ADD COLUMN "secondary_redemption_amount" DECIMAL(14,0);

ALTER TABLE "hojo_loan_progress_rate_config"
  ALTER COLUMN "interestRate" SET DEFAULT 0.15,
  ALTER COLUMN "feeRate" SET DEFAULT 0.5;

UPDATE "hojo_loan_progress_rate_config"
SET
  "interestRate" = CASE WHEN "interestRate" = 0 THEN 0.15 ELSE "interestRate" END,
  "feeRate" = CASE WHEN "feeRate" = 0 THEN 0.5 ELSE "feeRate" END;
