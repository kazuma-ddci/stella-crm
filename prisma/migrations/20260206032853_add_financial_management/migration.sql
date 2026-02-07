-- AlterTable
ALTER TABLE "stp_agents" ADD COLUMN     "agentInitialFee" INTEGER;

-- CreateTable
CREATE TABLE "stp_agent_commission_rules" (
    "id" SERIAL NOT NULL,
    "agentId" INTEGER NOT NULL,
    "stpCompanyId" INTEGER,
    "validFrom" DATE NOT NULL,
    "validTo" DATE,
    "initialFeeRate" DECIMAL(5,2),
    "initialFeeDuration" INTEGER,
    "performanceFeeRate" DECIMAL(5,2),
    "monthlyCommissionType" VARCHAR(10),
    "monthlyCommissionRate" DECIMAL(5,2),
    "monthlyCommissionFixed" INTEGER,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stp_agent_commission_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stp_revenue_records" (
    "id" SERIAL NOT NULL,
    "stpCompanyId" INTEGER NOT NULL,
    "contractHistoryId" INTEGER,
    "candidateId" INTEGER,
    "revenueType" VARCHAR(20) NOT NULL,
    "targetMonth" DATE NOT NULL,
    "expectedAmount" INTEGER NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "invoiceDate" DATE,
    "dueDate" DATE,
    "paidDate" DATE,
    "paidAmount" INTEGER,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stp_revenue_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stp_expense_records" (
    "id" SERIAL NOT NULL,
    "agentId" INTEGER NOT NULL,
    "stpCompanyId" INTEGER,
    "commissionRuleId" INTEGER,
    "revenueRecordId" INTEGER,
    "expenseType" VARCHAR(30) NOT NULL,
    "targetMonth" DATE NOT NULL,
    "expectedAmount" INTEGER NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "approvedDate" DATE,
    "paidDate" DATE,
    "paidAmount" INTEGER,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stp_expense_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "stp_agent_commission_rules_agentId_idx" ON "stp_agent_commission_rules"("agentId");

-- CreateIndex
CREATE INDEX "stp_agent_commission_rules_stpCompanyId_idx" ON "stp_agent_commission_rules"("stpCompanyId");

-- CreateIndex
CREATE INDEX "stp_agent_commission_rules_agentId_stpCompanyId_validFrom_idx" ON "stp_agent_commission_rules"("agentId", "stpCompanyId", "validFrom");

-- CreateIndex
CREATE INDEX "stp_revenue_records_stpCompanyId_idx" ON "stp_revenue_records"("stpCompanyId");

-- CreateIndex
CREATE INDEX "stp_revenue_records_targetMonth_idx" ON "stp_revenue_records"("targetMonth");

-- CreateIndex
CREATE INDEX "stp_revenue_records_status_idx" ON "stp_revenue_records"("status");

-- CreateIndex
CREATE INDEX "stp_revenue_records_stpCompanyId_targetMonth_idx" ON "stp_revenue_records"("stpCompanyId", "targetMonth");

-- CreateIndex
CREATE INDEX "stp_expense_records_agentId_idx" ON "stp_expense_records"("agentId");

-- CreateIndex
CREATE INDEX "stp_expense_records_stpCompanyId_idx" ON "stp_expense_records"("stpCompanyId");

-- CreateIndex
CREATE INDEX "stp_expense_records_targetMonth_idx" ON "stp_expense_records"("targetMonth");

-- CreateIndex
CREATE INDEX "stp_expense_records_status_idx" ON "stp_expense_records"("status");

-- CreateIndex
CREATE INDEX "stp_expense_records_agentId_targetMonth_idx" ON "stp_expense_records"("agentId", "targetMonth");

-- AddForeignKey
ALTER TABLE "stp_agent_commission_rules" ADD CONSTRAINT "stp_agent_commission_rules_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "stp_agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stp_agent_commission_rules" ADD CONSTRAINT "stp_agent_commission_rules_stpCompanyId_fkey" FOREIGN KEY ("stpCompanyId") REFERENCES "stp_companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stp_revenue_records" ADD CONSTRAINT "stp_revenue_records_stpCompanyId_fkey" FOREIGN KEY ("stpCompanyId") REFERENCES "stp_companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stp_revenue_records" ADD CONSTRAINT "stp_revenue_records_contractHistoryId_fkey" FOREIGN KEY ("contractHistoryId") REFERENCES "stp_contract_histories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stp_revenue_records" ADD CONSTRAINT "stp_revenue_records_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "stp_candidates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stp_expense_records" ADD CONSTRAINT "stp_expense_records_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "stp_agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stp_expense_records" ADD CONSTRAINT "stp_expense_records_stpCompanyId_fkey" FOREIGN KEY ("stpCompanyId") REFERENCES "stp_companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stp_expense_records" ADD CONSTRAINT "stp_expense_records_commissionRuleId_fkey" FOREIGN KEY ("commissionRuleId") REFERENCES "stp_agent_commission_rules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stp_expense_records" ADD CONSTRAINT "stp_expense_records_revenueRecordId_fkey" FOREIGN KEY ("revenueRecordId") REFERENCES "stp_revenue_records"("id") ON DELETE SET NULL ON UPDATE CASCADE;
