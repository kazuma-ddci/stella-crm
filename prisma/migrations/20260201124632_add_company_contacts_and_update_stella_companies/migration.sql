/*
  Warnings:

  - You are about to drop the column `contactPerson` on the `master_stella_companies` table. All the data in the column will be lost.
  - You are about to drop the column `email` on the `master_stella_companies` table. All the data in the column will be lost.
  - You are about to drop the column `phone` on the `master_stella_companies` table. All the data in the column will be lost.
  - You are about to drop the column `assignedTo` on the `stp_companies` table. All the data in the column will be lost.
  - You are about to drop the column `priority` on the `stp_companies` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "master_stella_companies" DROP COLUMN "contactPerson",
DROP COLUMN "email",
DROP COLUMN "phone",
ADD COLUMN     "industry" VARCHAR(100),
ADD COLUMN     "revenueScale" VARCHAR(100),
ADD COLUMN     "websiteUrl" VARCHAR(500);

-- AlterTable
ALTER TABLE "stp_companies" DROP COLUMN "assignedTo",
DROP COLUMN "priority",
ADD COLUMN     "accountId" VARCHAR(100),
ADD COLUMN     "accountPass" VARCHAR(100),
ADD COLUMN     "acquisitionChannel" VARCHAR(50),
ADD COLUMN     "billingAddress" TEXT,
ADD COLUMN     "billingCompanyName" VARCHAR(200),
ADD COLUMN     "billingEmail" VARCHAR(255),
ADD COLUMN     "billingRepresentative" VARCHAR(100),
ADD COLUMN     "contactMethods" VARCHAR(100),
ADD COLUMN     "contractNote" TEXT,
ADD COLUMN     "firstKoDate" DATE,
ADD COLUMN     "forecast" VARCHAR(20),
ADD COLUMN     "industry" VARCHAR(100),
ADD COLUMN     "industryType" VARCHAR(20),
ADD COLUMN     "jobInfoFolderLink" TEXT,
ADD COLUMN     "jobPostingStartDate" DATE,
ADD COLUMN     "lostReason" TEXT,
ADD COLUMN     "operationReportLink" TEXT,
ADD COLUMN     "operationStatus" VARCHAR(20),
ADD COLUMN     "paymentTerms" VARCHAR(100),
ADD COLUMN     "pendingReason" TEXT,
ADD COLUMN     "pendingResponseDate" DATE,
ADD COLUMN     "plannedHires" INTEGER,
ADD COLUMN     "progressDetail" TEXT,
ADD COLUMN     "proposalLink" TEXT;

-- AlterTable
ALTER TABLE "stp_stage_histories" ADD COLUMN     "isVoided" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "lostReason" TEXT,
ADD COLUMN     "pendingReason" TEXT,
ADD COLUMN     "subType" VARCHAR(20),
ADD COLUMN     "voidReason" TEXT,
ADD COLUMN     "voidedAt" TIMESTAMP(3),
ADD COLUMN     "voidedBy" VARCHAR(100);

-- AlterTable
ALTER TABLE "stp_stages" ADD COLUMN     "stageType" VARCHAR(20) NOT NULL DEFAULT 'progress',
ALTER COLUMN "displayOrder" DROP NOT NULL;

-- CreateTable
CREATE TABLE "company_contacts" (
    "id" SERIAL NOT NULL,
    "companyId" INTEGER NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "email" VARCHAR(255),
    "phone" VARCHAR(50),
    "department" VARCHAR(100),
    "address" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "company_contacts_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "company_contacts" ADD CONSTRAINT "company_contacts_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "master_stella_companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
