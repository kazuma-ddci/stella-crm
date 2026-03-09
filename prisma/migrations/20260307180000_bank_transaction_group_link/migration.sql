-- AlterTable: PaymentMethod に availableFor カラム追加
ALTER TABLE "PaymentMethod" ADD COLUMN "availableFor" TEXT NOT NULL DEFAULT 'both';

-- AlterTable: BankTransaction に invoiceGroupId, paymentGroupId カラム追加
ALTER TABLE "BankTransaction" ADD COLUMN "invoiceGroupId" INTEGER;
ALTER TABLE "BankTransaction" ADD COLUMN "paymentGroupId" INTEGER;

-- AddForeignKey
ALTER TABLE "BankTransaction" ADD CONSTRAINT "BankTransaction_invoiceGroupId_fkey"
  FOREIGN KEY ("invoiceGroupId") REFERENCES "InvoiceGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "BankTransaction" ADD CONSTRAINT "BankTransaction_paymentGroupId_fkey"
  FOREIGN KEY ("paymentGroupId") REFERENCES "PaymentGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;
