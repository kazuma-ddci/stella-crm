-- AlterTable
ALTER TABLE "JournalEntry" ADD COLUMN "sourceReconciliationId" INTEGER;

-- AddForeignKey
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_sourceReconciliationId_fkey" FOREIGN KEY ("sourceReconciliationId") REFERENCES "Reconciliation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
