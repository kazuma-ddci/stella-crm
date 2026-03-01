-- DropForeignKey
ALTER TABLE "OperatingCompanyEmail" DROP CONSTRAINT "OperatingCompanyEmail_operatingCompanyId_fkey";

-- AlterTable
ALTER TABLE "OperatingCompanyEmail" ALTER COLUMN "operatingCompanyId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "OperatingCompanyEmail" ADD CONSTRAINT "OperatingCompanyEmail_operatingCompanyId_fkey" FOREIGN KEY ("operatingCompanyId") REFERENCES "operating_companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
