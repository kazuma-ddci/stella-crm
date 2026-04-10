-- Rename annual_labor_cost to annual_labor_cost_executive (役員様分) and add annual_labor_cost_employee (従業員様分)
ALTER TABLE "slp_company_records"
  RENAME COLUMN "annual_labor_cost" TO "annual_labor_cost_executive";

ALTER TABLE "slp_company_records"
  ADD COLUMN "annual_labor_cost_employee" DECIMAL(15, 2);
