-- AlterTable
ALTER TABLE "PaymentGroup" ADD COLUMN     "isConfidential" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "paymentType" TEXT NOT NULL DEFAULT 'invoice';

-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "isConfidential" BOOLEAN NOT NULL DEFAULT false;
