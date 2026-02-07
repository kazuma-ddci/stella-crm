/*
  Warnings:

  - You are about to drop the column `commissionRuleId` on the `stp_expense_records` table. All the data in the column will be lost.
  - You are about to drop the `stp_agent_commission_rules` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "stp_agent_commission_rules" DROP CONSTRAINT "stp_agent_commission_rules_agentId_fkey";

-- DropForeignKey
ALTER TABLE "stp_agent_commission_rules" DROP CONSTRAINT "stp_agent_commission_rules_stpCompanyId_fkey";

-- DropForeignKey
ALTER TABLE "stp_expense_records" DROP CONSTRAINT "stp_expense_records_commissionRuleId_fkey";

-- AlterTable
ALTER TABLE "stp_contract_histories" ADD COLUMN     "agentCommInitialDuration" INTEGER,
ADD COLUMN     "agentCommInitialRate" DECIMAL(5,2),
ADD COLUMN     "agentCommMonthlyFixed" INTEGER,
ADD COLUMN     "agentCommMonthlyRate" DECIMAL(5,2),
ADD COLUMN     "agentCommMonthlyType" VARCHAR(10),
ADD COLUMN     "agentCommPerformanceRate" DECIMAL(5,2);

-- AlterTable
ALTER TABLE "stp_expense_records" DROP COLUMN "commissionRuleId",
ADD COLUMN     "agentContractHistoryId" INTEGER,
ADD COLUMN     "contractHistoryId" INTEGER;

-- DropTable
DROP TABLE "stp_agent_commission_rules";

-- CreateTable
CREATE TABLE "stp_agent_contract_histories" (
    "id" SERIAL NOT NULL,
    "agentId" INTEGER NOT NULL,
    "contractStartDate" DATE NOT NULL,
    "contractEndDate" DATE,
    "status" VARCHAR(20) NOT NULL,
    "initialFee" INTEGER,
    "monthlyFee" INTEGER,
    "defaultCommInitialRate" DECIMAL(5,2),
    "defaultCommInitialDuration" INTEGER,
    "defaultCommPerformanceRate" DECIMAL(5,2),
    "defaultCommMonthlyType" VARCHAR(10),
    "defaultCommMonthlyRate" DECIMAL(5,2),
    "defaultCommMonthlyFixed" INTEGER,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "stp_agent_contract_histories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "stp_agent_contract_histories_agentId_idx" ON "stp_agent_contract_histories"("agentId");

-- CreateIndex
CREATE INDEX "stp_agent_contract_histories_agentId_contractStartDate_idx" ON "stp_agent_contract_histories"("agentId", "contractStartDate");

-- AddForeignKey
ALTER TABLE "stp_agent_contract_histories" ADD CONSTRAINT "stp_agent_contract_histories_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "stp_agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stp_expense_records" ADD CONSTRAINT "stp_expense_records_agentContractHistoryId_fkey" FOREIGN KEY ("agentContractHistoryId") REFERENCES "stp_agent_contract_histories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stp_expense_records" ADD CONSTRAINT "stp_expense_records_contractHistoryId_fkey" FOREIGN KEY ("contractHistoryId") REFERENCES "stp_contract_histories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
