-- CreateTable
CREATE TABLE "stella_company_bank_accounts" (
    "id" SERIAL NOT NULL,
    "companyId" INTEGER NOT NULL,
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

    CONSTRAINT "stella_company_bank_accounts_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "stella_company_bank_accounts" ADD CONSTRAINT "stella_company_bank_accounts_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "master_stella_companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
