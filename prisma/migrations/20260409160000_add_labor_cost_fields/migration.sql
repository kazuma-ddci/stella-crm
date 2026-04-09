-- Add annual labor cost and average monthly salary fields to slp_company_records
ALTER TABLE "slp_company_records"
  ADD COLUMN "annual_labor_cost" DECIMAL(15, 2),
  ADD COLUMN "average_monthly_salary" DECIMAL(15, 2);
