/*
  Warnings:

  - You are about to drop the `stella_contracts` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "stella_contracts" DROP CONSTRAINT "stella_contracts_companyId_fkey";

-- DropForeignKey
ALTER TABLE "stella_contracts" DROP CONSTRAINT "stella_contracts_operationStaffId_fkey";

-- DropForeignKey
ALTER TABLE "stella_contracts" DROP CONSTRAINT "stella_contracts_salesStaffId_fkey";

-- DropTable
DROP TABLE "stella_contracts";

-- CreateTable
CREATE TABLE "stp_contract_histories" (
    "id" SERIAL NOT NULL,
    "companyId" INTEGER NOT NULL,
    "industryType" VARCHAR(20) NOT NULL,
    "contractPlan" VARCHAR(20) NOT NULL,
    "contractStartDate" DATE NOT NULL,
    "contractEndDate" DATE,
    "initialFee" INTEGER NOT NULL,
    "monthlyFee" INTEGER NOT NULL,
    "performanceFee" INTEGER NOT NULL,
    "salesStaffId" INTEGER,
    "operationStaffId" INTEGER,
    "status" VARCHAR(20) NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stp_contract_histories_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "stp_contract_histories" ADD CONSTRAINT "stp_contract_histories_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "master_stella_companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stp_contract_histories" ADD CONSTRAINT "stp_contract_histories_salesStaffId_fkey" FOREIGN KEY ("salesStaffId") REFERENCES "staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stp_contract_histories" ADD CONSTRAINT "stp_contract_histories_operationStaffId_fkey" FOREIGN KEY ("operationStaffId") REFERENCES "staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;
