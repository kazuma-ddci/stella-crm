-- AlterTable: make expenseCategoryId nullable on Transaction
ALTER TABLE "Transaction" ALTER COLUMN "expenseCategoryId" DROP NOT NULL;
