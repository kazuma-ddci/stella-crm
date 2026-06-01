-- Add operating company and bank account links for accounting-only cost centers.

ALTER TABLE "CostCenter"
ADD COLUMN "operating_company_id" INTEGER;

CREATE TABLE "cost_center_bank_accounts" (
    "id" SERIAL NOT NULL,
    "cost_center_id" INTEGER NOT NULL,
    "bank_account_id" INTEGER NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "memo" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cost_center_bank_accounts_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CostCenter_operating_company_id_idx" ON "CostCenter"("operating_company_id");

CREATE UNIQUE INDEX "cost_center_bank_accounts_cost_center_id_bank_account_id_key"
ON "cost_center_bank_accounts"("cost_center_id", "bank_account_id");

ALTER TABLE "CostCenter"
ADD CONSTRAINT "CostCenter_operating_company_id_fkey"
FOREIGN KEY ("operating_company_id") REFERENCES "operating_companies"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "cost_center_bank_accounts"
ADD CONSTRAINT "cost_center_bank_accounts_cost_center_id_fkey"
FOREIGN KEY ("cost_center_id") REFERENCES "CostCenter"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "cost_center_bank_accounts"
ADD CONSTRAINT "cost_center_bank_accounts_bank_account_id_fkey"
FOREIGN KEY ("bank_account_id") REFERENCES "operating_company_bank_accounts"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
