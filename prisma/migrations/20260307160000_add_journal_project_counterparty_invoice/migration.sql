-- AlterTable: JournalEntry にプロジェクト・取引先・インボイス有無を追加
ALTER TABLE "JournalEntry" ADD COLUMN "projectId" INTEGER;
ALTER TABLE "JournalEntry" ADD COLUMN "counterpartyId" INTEGER;
ALTER TABLE "JournalEntry" ADD COLUMN "hasInvoice" BOOLEAN NOT NULL DEFAULT true;

-- AddForeignKey
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "master_projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_counterpartyId_fkey" FOREIGN KEY ("counterpartyId") REFERENCES "Counterparty"("id") ON DELETE SET NULL ON UPDATE CASCADE;
