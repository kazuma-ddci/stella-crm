-- AlterTable
ALTER TABLE "stp_expense_records" ADD COLUMN     "latestCalculatedAmount" INTEGER,
ADD COLUMN     "sourceDataChangedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "stp_revenue_records" ADD COLUMN     "latestCalculatedAmount" INTEGER,
ADD COLUMN     "sourceDataChangedAt" TIMESTAMP(3);
