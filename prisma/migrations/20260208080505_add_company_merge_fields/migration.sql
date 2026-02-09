-- DropIndex
DROP INDEX "stp_agents_companyId_key";

-- AlterTable
ALTER TABLE "master_stella_companies" ADD COLUMN     "mergedAt" TIMESTAMP(3),
ADD COLUMN     "mergedIntoId" INTEGER;

-- AddForeignKey
ALTER TABLE "master_stella_companies" ADD CONSTRAINT "master_stella_companies_mergedIntoId_fkey" FOREIGN KEY ("mergedIntoId") REFERENCES "master_stella_companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
