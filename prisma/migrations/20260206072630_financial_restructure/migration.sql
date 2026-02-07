/*
  Warnings:

  - You are about to drop the column `agentCommInitialDuration` on the `stp_contract_histories` table. All the data in the column will be lost.
  - You are about to drop the column `agentCommInitialRate` on the `stp_contract_histories` table. All the data in the column will be lost.
  - You are about to drop the column `agentCommMonthlyFixed` on the `stp_contract_histories` table. All the data in the column will be lost.
  - You are about to drop the column `agentCommMonthlyRate` on the `stp_contract_histories` table. All the data in the column will be lost.
  - You are about to drop the column `agentCommMonthlyType` on the `stp_contract_histories` table. All the data in the column will be lost.
  - You are about to drop the column `agentCommPerformanceRate` on the `stp_contract_histories` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "stp_contract_histories" DROP COLUMN "agentCommInitialDuration",
DROP COLUMN "agentCommInitialRate",
DROP COLUMN "agentCommMonthlyFixed",
DROP COLUMN "agentCommMonthlyRate",
DROP COLUMN "agentCommMonthlyType",
DROP COLUMN "agentCommPerformanceRate";

-- AlterTable
ALTER TABLE "stp_expense_records" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "stp_revenue_records" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "stp_agent_commission_overrides" (
    "id" SERIAL NOT NULL,
    "agentContractHistoryId" INTEGER NOT NULL,
    "stpCompanyId" INTEGER NOT NULL,
    "commInitialRate" DECIMAL(5,2),
    "commInitialDuration" INTEGER,
    "commPerformanceRate" DECIMAL(5,2),
    "commMonthlyType" VARCHAR(10),
    "commMonthlyRate" DECIMAL(5,2),
    "commMonthlyFixed" INTEGER,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stp_agent_commission_overrides_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "stp_agent_commission_overrides_agentContractHistoryId_idx" ON "stp_agent_commission_overrides"("agentContractHistoryId");

-- CreateIndex
CREATE INDEX "stp_agent_commission_overrides_stpCompanyId_idx" ON "stp_agent_commission_overrides"("stpCompanyId");

-- CreateIndex
CREATE UNIQUE INDEX "stp_agent_commission_overrides_agentContractHistoryId_stpCo_key" ON "stp_agent_commission_overrides"("agentContractHistoryId", "stpCompanyId");

-- AddForeignKey
ALTER TABLE "stp_agent_commission_overrides" ADD CONSTRAINT "stp_agent_commission_overrides_agentContractHistoryId_fkey" FOREIGN KEY ("agentContractHistoryId") REFERENCES "stp_agent_contract_histories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stp_agent_commission_overrides" ADD CONSTRAINT "stp_agent_commission_overrides_stpCompanyId_fkey" FOREIGN KEY ("stpCompanyId") REFERENCES "stp_companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
