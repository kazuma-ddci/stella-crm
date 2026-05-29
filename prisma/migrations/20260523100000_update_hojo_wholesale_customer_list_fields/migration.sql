-- 顧客リスト項目変更
ALTER TABLE "hojo_wholesale_accounts"
  ADD COLUMN "loan_usage" VARCHAR(10),
  ADD COLUMN "grant_usage" VARCHAR(10),
  ADD COLUMN "subsidy_target_amount_tax_included" INTEGER,
  ADD COLUMN "application_amount" INTEGER,
  DROP COLUMN "tool_cost",
  DROP COLUMN "invoice_status";
