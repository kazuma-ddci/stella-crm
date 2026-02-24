-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "scheduledPaymentDate" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "cost_center_project_assignments" (
    "id" SERIAL NOT NULL,
    "costCenterId" INTEGER NOT NULL,
    "projectId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cost_center_project_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransactionCandidateDecision" (
    "id" SERIAL NOT NULL,
    "candidateKey" VARCHAR(200) NOT NULL,
    "targetMonth" VARCHAR(7) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "reasonType" VARCHAR(50),
    "memo" TEXT,
    "needsReview" BOOLEAN NOT NULL DEFAULT false,
    "sourceFingerprint" TEXT,
    "overrideAmount" INTEGER,
    "overrideTaxAmount" INTEGER,
    "overrideTaxRate" INTEGER,
    "overrideMemo" TEXT,
    "overrideScheduledPaymentDate" DATE,
    "decidedBy" INTEGER,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TransactionCandidateDecision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_project_bindings" (
    "id" SERIAL NOT NULL,
    "routeKey" VARCHAR(50) NOT NULL,
    "projectId" INTEGER NOT NULL,
    "defaultCostCenterId" INTEGER,
    "operatingCompanyId" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_project_bindings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "cost_center_project_assignments_costCenterId_projectId_key" ON "cost_center_project_assignments"("costCenterId", "projectId");

-- CreateIndex
CREATE UNIQUE INDEX "TransactionCandidateDecision_candidateKey_targetMonth_key" ON "TransactionCandidateDecision"("candidateKey", "targetMonth");

-- CreateIndex
CREATE UNIQUE INDEX "system_project_bindings_routeKey_key" ON "system_project_bindings"("routeKey");

-- AddForeignKey
ALTER TABLE "cost_center_project_assignments" ADD CONSTRAINT "cost_center_project_assignments_costCenterId_fkey" FOREIGN KEY ("costCenterId") REFERENCES "CostCenter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cost_center_project_assignments" ADD CONSTRAINT "cost_center_project_assignments_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "master_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransactionCandidateDecision" ADD CONSTRAINT "TransactionCandidateDecision_decidedBy_fkey" FOREIGN KEY ("decidedBy") REFERENCES "master_staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "system_project_bindings" ADD CONSTRAINT "system_project_bindings_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "master_projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "system_project_bindings" ADD CONSTRAINT "system_project_bindings_defaultCostCenterId_fkey" FOREIGN KEY ("defaultCostCenterId") REFERENCES "CostCenter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "system_project_bindings" ADD CONSTRAINT "system_project_bindings_operatingCompanyId_fkey" FOREIGN KEY ("operatingCompanyId") REFERENCES "operating_companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
