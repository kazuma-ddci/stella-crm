-- AlterTable
ALTER TABLE "OperatingCompanyEmail" ADD COLUMN     "enableInbound" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "imapHost" TEXT,
ADD COLUMN     "imapPass" TEXT,
ADD COLUMN     "imapPort" INTEGER,
ADD COLUMN     "imapUser" TEXT;

-- AlterTable
ALTER TABLE "PaymentGroup" ADD COLUMN     "expectedInboundEmailId" INTEGER,
ADD COLUMN     "referenceCode" TEXT;

-- CreateTable
CREATE TABLE "InboundInvoice" (
    "id" SERIAL NOT NULL,
    "messageId" TEXT NOT NULL,
    "attachmentIndex" INTEGER NOT NULL,
    "receivedByEmailId" INTEGER NOT NULL,
    "fromEmail" TEXT NOT NULL,
    "fromName" TEXT,
    "subject" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL,
    "paymentGroupId" INTEGER,
    "matchConfidence" TEXT,
    "referenceCode" TEXT,
    "attachmentFileName" TEXT,
    "attachmentPath" TEXT,
    "attachmentSize" INTEGER,
    "attachmentMimeType" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "processedBy" INTEGER,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InboundInvoice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "InboundInvoice_messageId_attachmentIndex_key" ON "InboundInvoice"("messageId", "attachmentIndex");

-- Backfill referenceCode for existing PaymentGroups
UPDATE "PaymentGroup"
SET "referenceCode" = 'PG-' || LPAD(CAST(id AS TEXT), 4, '0')
WHERE "referenceCode" IS NULL AND "deletedAt" IS NULL;

-- CreateIndex (after backfill to avoid conflicts)
CREATE UNIQUE INDEX "PaymentGroup_referenceCode_key" ON "PaymentGroup"("referenceCode");

-- AddForeignKey
ALTER TABLE "PaymentGroup" ADD CONSTRAINT "PaymentGroup_expectedInboundEmailId_fkey" FOREIGN KEY ("expectedInboundEmailId") REFERENCES "OperatingCompanyEmail"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InboundInvoice" ADD CONSTRAINT "InboundInvoice_receivedByEmailId_fkey" FOREIGN KEY ("receivedByEmailId") REFERENCES "OperatingCompanyEmail"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InboundInvoice" ADD CONSTRAINT "InboundInvoice_paymentGroupId_fkey" FOREIGN KEY ("paymentGroupId") REFERENCES "PaymentGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InboundInvoice" ADD CONSTRAINT "InboundInvoice_processedBy_fkey" FOREIGN KEY ("processedBy") REFERENCES "master_staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;
