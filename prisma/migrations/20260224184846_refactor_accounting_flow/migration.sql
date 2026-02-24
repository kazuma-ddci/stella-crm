-- AlterTable
ALTER TABLE "Attachment" ADD COLUMN     "invoiceGroupId" INTEGER,
ADD COLUMN     "paymentGroupId" INTEGER;

-- AlterTable
ALTER TABLE "Counterparty" ADD COLUMN     "displayId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Counterparty_displayId_key" ON "Counterparty"("displayId");

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_invoiceGroupId_fkey" FOREIGN KEY ("invoiceGroupId") REFERENCES "InvoiceGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_paymentGroupId_fkey" FOREIGN KEY ("paymentGroupId") REFERENCES "PaymentGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;
