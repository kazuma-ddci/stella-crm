-- Add accounting project links to invoice/payment groups.

ALTER TABLE "InvoiceGroup"
ADD COLUMN "costCenterId" INTEGER;

ALTER TABLE "PaymentGroup"
ADD COLUMN "costCenterId" INTEGER;

UPDATE "InvoiceGroup" AS ig
SET "costCenterId" = mp."default_cost_center_id"
FROM "master_projects" AS mp
WHERE ig."projectId" = mp."id"
  AND ig."costCenterId" IS NULL
  AND mp."default_cost_center_id" IS NOT NULL;

UPDATE "PaymentGroup" AS pg
SET "costCenterId" = mp."default_cost_center_id"
FROM "master_projects" AS mp
WHERE pg."projectId" = mp."id"
  AND pg."costCenterId" IS NULL
  AND mp."default_cost_center_id" IS NOT NULL;

CREATE INDEX "InvoiceGroup_costCenterId_idx" ON "InvoiceGroup"("costCenterId");
CREATE INDEX "PaymentGroup_costCenterId_idx" ON "PaymentGroup"("costCenterId");

ALTER TABLE "InvoiceGroup"
ADD CONSTRAINT "InvoiceGroup_costCenterId_fkey"
FOREIGN KEY ("costCenterId") REFERENCES "CostCenter"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PaymentGroup"
ADD CONSTRAINT "PaymentGroup_costCenterId_fkey"
FOREIGN KEY ("costCenterId") REFERENCES "CostCenter"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
