-- AlterTable
ALTER TABLE "master_stella_companies" ADD COLUMN "staffId" INTEGER;

-- AddForeignKey
ALTER TABLE "master_stella_companies" ADD CONSTRAINT "master_stella_companies_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "master_staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;
