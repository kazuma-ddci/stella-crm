-- AlterTable: StpContractHistory に contractDate カラムを追加
ALTER TABLE "stp_contract_histories" ADD COLUMN "contractDate" DATE;

-- CreateTable: StpBillingRule
CREATE TABLE "stp_billing_rules" (
    "id" SERIAL NOT NULL,
    "projectId" INTEGER NOT NULL,
    "feeType" TEXT NOT NULL,
    "invoiceBusinessDays" INTEGER DEFAULT 3,
    "paymentBusinessDays" INTEGER DEFAULT 5,
    "closingDay" INTEGER DEFAULT 0,
    "paymentMonthOffset" INTEGER DEFAULT 1,
    "paymentDay" INTEGER DEFAULT 15,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "stp_billing_rules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "stp_billing_rules_projectId_feeType_key" ON "stp_billing_rules"("projectId", "feeType");

-- AddForeignKey
ALTER TABLE "stp_billing_rules" ADD CONSTRAINT "stp_billing_rules_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "master_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
