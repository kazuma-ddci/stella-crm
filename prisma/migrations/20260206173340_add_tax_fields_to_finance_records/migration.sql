-- AlterTable
ALTER TABLE "stp_expense_records" ADD COLUMN     "taxAmount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "taxRate" INTEGER NOT NULL DEFAULT 10,
ADD COLUMN     "taxType" VARCHAR(20) NOT NULL DEFAULT 'tax_included';

-- AlterTable
ALTER TABLE "stp_revenue_records" ADD COLUMN     "taxAmount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "taxRate" INTEGER NOT NULL DEFAULT 10,
ADD COLUMN     "taxType" VARCHAR(20) NOT NULL DEFAULT 'tax_included';
