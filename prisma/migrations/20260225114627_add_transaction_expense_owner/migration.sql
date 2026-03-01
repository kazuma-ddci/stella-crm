-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "hasExpenseOwner" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "TransactionExpenseOwner" (
    "id" SERIAL NOT NULL,
    "transactionId" INTEGER NOT NULL,
    "staffId" INTEGER,
    "customName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TransactionExpenseOwner_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TransactionExpenseOwner_transactionId_idx" ON "TransactionExpenseOwner"("transactionId");

-- CreateIndex
CREATE UNIQUE INDEX "TransactionExpenseOwner_transactionId_staffId_key" ON "TransactionExpenseOwner"("transactionId", "staffId");

-- AddForeignKey
ALTER TABLE "TransactionExpenseOwner" ADD CONSTRAINT "TransactionExpenseOwner_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransactionExpenseOwner" ADD CONSTRAINT "TransactionExpenseOwner_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "master_staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;
