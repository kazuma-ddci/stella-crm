-- AlterTable
ALTER TABLE "InvoiceGroup" ADD COLUMN     "actualPaymentDate" TIMESTAMP(3),
ADD COLUMN     "expectedPaymentDate" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "PaymentGroup" ADD COLUMN     "paymentDueDate" TIMESTAMP(3);
