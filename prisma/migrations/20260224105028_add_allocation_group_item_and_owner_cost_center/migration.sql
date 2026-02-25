-- AlterTable
ALTER TABLE "AllocationTemplate" ADD COLUMN     "ownerCostCenterId" INTEGER;

-- CreateTable
CREATE TABLE "AllocationGroupItem" (
    "id" SERIAL NOT NULL,
    "transactionId" INTEGER NOT NULL,
    "costCenterId" INTEGER NOT NULL,
    "groupType" TEXT NOT NULL,
    "allocatedAmount" INTEGER NOT NULL,
    "allocatedTaxAmount" INTEGER NOT NULL,
    "invoiceGroupId" INTEGER,
    "paymentGroupId" INTEGER,
    "createdBy" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AllocationGroupItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AllocationGroupItem_invoiceGroupId_idx" ON "AllocationGroupItem"("invoiceGroupId");

-- CreateIndex
CREATE INDEX "AllocationGroupItem_paymentGroupId_idx" ON "AllocationGroupItem"("paymentGroupId");

-- CreateIndex
CREATE INDEX "AllocationGroupItem_transactionId_idx" ON "AllocationGroupItem"("transactionId");

-- CreateIndex
CREATE UNIQUE INDEX "AllocationGroupItem_transactionId_costCenterId_groupType_key" ON "AllocationGroupItem"("transactionId", "costCenterId", "groupType");

-- AddForeignKey
ALTER TABLE "AllocationTemplate" ADD CONSTRAINT "AllocationTemplate_ownerCostCenterId_fkey" FOREIGN KEY ("ownerCostCenterId") REFERENCES "CostCenter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AllocationGroupItem" ADD CONSTRAINT "AllocationGroupItem_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AllocationGroupItem" ADD CONSTRAINT "AllocationGroupItem_costCenterId_fkey" FOREIGN KEY ("costCenterId") REFERENCES "CostCenter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AllocationGroupItem" ADD CONSTRAINT "AllocationGroupItem_invoiceGroupId_fkey" FOREIGN KEY ("invoiceGroupId") REFERENCES "InvoiceGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AllocationGroupItem" ADD CONSTRAINT "AllocationGroupItem_paymentGroupId_fkey" FOREIGN KEY ("paymentGroupId") REFERENCES "PaymentGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AllocationGroupItem" ADD CONSTRAINT "AllocationGroupItem_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "master_staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;
