/*
  Warnings:

  - You are about to drop the column `bankInfo` on the `operating_companies` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "operating_companies" DROP COLUMN "bankInfo";

-- CreateTable
CREATE TABLE "operating_company_bank_accounts" (
    "id" SERIAL NOT NULL,
    "operatingCompanyId" INTEGER NOT NULL,
    "bankName" VARCHAR(100) NOT NULL,
    "bankCode" VARCHAR(10) NOT NULL,
    "branchName" VARCHAR(100) NOT NULL,
    "branchCode" VARCHAR(10) NOT NULL,
    "accountNumber" VARCHAR(20) NOT NULL,
    "accountHolderName" VARCHAR(200) NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "operating_company_bank_accounts_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "operating_company_bank_accounts" ADD CONSTRAINT "operating_company_bank_accounts_operatingCompanyId_fkey" FOREIGN KEY ("operatingCompanyId") REFERENCES "operating_companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
