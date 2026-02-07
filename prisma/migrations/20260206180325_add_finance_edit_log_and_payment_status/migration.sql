-- AlterTable
ALTER TABLE "stp_expense_records" ADD COLUMN     "paymentStatus" VARCHAR(20);

-- AlterTable
ALTER TABLE "stp_revenue_records" ADD COLUMN     "paymentStatus" VARCHAR(20);

-- CreateTable
CREATE TABLE "stp_finance_edit_logs" (
    "id" SERIAL NOT NULL,
    "revenueRecordId" INTEGER,
    "expenseRecordId" INTEGER,
    "editType" VARCHAR(30) NOT NULL,
    "fieldName" VARCHAR(50),
    "oldValue" TEXT,
    "newValue" TEXT,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stp_finance_edit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "stp_finance_edit_logs_revenueRecordId_idx" ON "stp_finance_edit_logs"("revenueRecordId");

-- CreateIndex
CREATE INDEX "stp_finance_edit_logs_expenseRecordId_idx" ON "stp_finance_edit_logs"("expenseRecordId");

-- AddForeignKey
ALTER TABLE "stp_finance_edit_logs" ADD CONSTRAINT "stp_finance_edit_logs_revenueRecordId_fkey" FOREIGN KEY ("revenueRecordId") REFERENCES "stp_revenue_records"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stp_finance_edit_logs" ADD CONSTRAINT "stp_finance_edit_logs_expenseRecordId_fkey" FOREIGN KEY ("expenseRecordId") REFERENCES "stp_expense_records"("id") ON DELETE SET NULL ON UPDATE CASCADE;
