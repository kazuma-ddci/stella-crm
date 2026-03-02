/*
  Warnings:

  - You are about to drop the `stp_payment_allocations` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `stp_payment_transactions` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "stp_payment_allocations" DROP CONSTRAINT "stp_payment_allocations_expenseRecordId_fkey";

-- DropForeignKey
ALTER TABLE "stp_payment_allocations" DROP CONSTRAINT "stp_payment_allocations_paymentTransactionId_fkey";

-- DropForeignKey
ALTER TABLE "stp_payment_allocations" DROP CONSTRAINT "stp_payment_allocations_revenueRecordId_fkey";

-- DropForeignKey
ALTER TABLE "stp_payment_transactions" DROP CONSTRAINT "stp_payment_transactions_processedBy_fkey";

-- DropTable
DROP TABLE "stp_payment_allocations";

-- DropTable
DROP TABLE "stp_payment_transactions";
