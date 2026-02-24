-- AlterTable
ALTER TABLE "InvoiceGroup" ADD COLUMN     "projectId" INTEGER;

-- AlterTable
ALTER TABLE "PaymentGroup" ADD COLUMN     "projectId" INTEGER;

-- AddForeignKey
ALTER TABLE "InvoiceGroup" ADD CONSTRAINT "InvoiceGroup_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "master_projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentGroup" ADD CONSTRAINT "PaymentGroup_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "master_projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill: 既存データにSTPプロジェクト(id=1)を設定
UPDATE "InvoiceGroup" SET "projectId" = 1 WHERE "projectId" IS NULL AND "deletedAt" IS NULL;
UPDATE "PaymentGroup" SET "projectId" = 1 WHERE "projectId" IS NULL AND "deletedAt" IS NULL;
UPDATE "Transaction" SET "projectId" = 1 WHERE "projectId" IS NULL AND "deletedAt" IS NULL;
