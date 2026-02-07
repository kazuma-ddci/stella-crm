/*
  Warnings:

  - You are about to drop the column `expenseRecordId` on the `stp_invoices` table. All the data in the column will be lost.
  - You are about to drop the column `revenueRecordId` on the `stp_invoices` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "stp_invoices" DROP CONSTRAINT "stp_invoices_expenseRecordId_fkey";

-- DropForeignKey
ALTER TABLE "stp_invoices" DROP CONSTRAINT "stp_invoices_revenueRecordId_fkey";

-- AlterTable
ALTER TABLE "stp_expense_records" ADD COLUMN     "invoiceId" INTEGER;

-- AlterTable
ALTER TABLE "stp_invoices" DROP COLUMN "expenseRecordId",
DROP COLUMN "revenueRecordId";

-- AlterTable
ALTER TABLE "stp_revenue_records" ADD COLUMN     "invoiceId" INTEGER;

-- CreateIndex
CREATE INDEX "stp_expense_records_invoiceId_idx" ON "stp_expense_records"("invoiceId");

-- CreateIndex
CREATE INDEX "stp_revenue_records_invoiceId_idx" ON "stp_revenue_records"("invoiceId");

-- AddForeignKey
ALTER TABLE "stp_revenue_records" ADD CONSTRAINT "stp_revenue_records_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "stp_invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stp_expense_records" ADD CONSTRAINT "stp_expense_records_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "stp_invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;
