-- JournalEntry: 実現/未実現ステータス + 入出金紐付け
ALTER TABLE "JournalEntry" ADD COLUMN "bankTransactionId" INTEGER;
ALTER TABLE "JournalEntry" ADD COLUMN "realizationStatus" TEXT NOT NULL DEFAULT 'realized';
ALTER TABLE "JournalEntry" ADD COLUMN "scheduledDate" TIMESTAMP(3);
ALTER TABLE "JournalEntry" ADD COLUMN "realizedAt" TIMESTAMP(3);
ALTER TABLE "JournalEntry" ADD COLUMN "realizedBy" INTEGER;

-- JournalEntryLine: 消費税区分・税額
ALTER TABLE "JournalEntryLine" ADD COLUMN "taxClassification" TEXT;
ALTER TABLE "JournalEntryLine" ADD COLUMN "taxAmount" INTEGER;

-- Counterparty: インボイス制度対応
ALTER TABLE "Counterparty" ADD COLUMN "isInvoiceRegistered" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Counterparty" ADD COLUMN "invoiceRegistrationNumber" TEXT;

-- FK制約
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_bankTransactionId_fkey" FOREIGN KEY ("bankTransactionId") REFERENCES "BankTransaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_realizedBy_fkey" FOREIGN KEY ("realizedBy") REFERENCES "master_staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;
