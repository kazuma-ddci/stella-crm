-- CreateTable
CREATE TABLE "accounting_import_batches" (
    "id" SERIAL NOT NULL,
    "source" VARCHAR(20) NOT NULL,
    "sourceService" VARCHAR(30),
    "fileName" VARCHAR(500),
    "periodFrom" DATE,
    "periodTo" DATE,
    "totalCount" INTEGER NOT NULL DEFAULT 0,
    "newCount" INTEGER NOT NULL DEFAULT 0,
    "duplicateCount" INTEGER NOT NULL DEFAULT 0,
    "status" VARCHAR(20) NOT NULL DEFAULT 'processing',
    "errorMessage" TEXT,
    "importedBy" INTEGER NOT NULL,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "accounting_import_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounting_transactions" (
    "id" SERIAL NOT NULL,
    "direction" VARCHAR(10) NOT NULL,
    "transactionDate" DATE NOT NULL,
    "valueDate" DATE,
    "amount" INTEGER NOT NULL,
    "taxAmount" INTEGER,
    "counterpartyName" VARCHAR(200) NOT NULL,
    "counterpartyCode" VARCHAR(50),
    "description" TEXT,
    "memo" TEXT,
    "accountCode" VARCHAR(20),
    "accountName" VARCHAR(100),
    "bankAccountName" VARCHAR(100),
    "source" VARCHAR(20) NOT NULL,
    "sourceService" VARCHAR(30),
    "sourceTransactionId" VARCHAR(100),
    "sourceDealId" VARCHAR(100),
    "importBatchId" INTEGER,
    "reconciliationStatus" VARCHAR(20) NOT NULL DEFAULT 'unmatched',
    "projectId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "accounting_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounting_reconciliations" (
    "id" SERIAL NOT NULL,
    "transactionId" INTEGER NOT NULL,
    "projectCode" VARCHAR(20) NOT NULL,
    "recordType" VARCHAR(20) NOT NULL,
    "revenueRecordId" INTEGER,
    "expenseRecordId" INTEGER,
    "allocatedAmount" INTEGER NOT NULL,
    "note" TEXT,
    "matchMethod" VARCHAR(10) NOT NULL DEFAULT 'manual',
    "matchedBy" INTEGER,
    "matchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "accounting_reconciliations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounting_verifications" (
    "id" SERIAL NOT NULL,
    "transactionId" INTEGER NOT NULL,
    "verificationType" VARCHAR(20) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "verifiedBy" INTEGER NOT NULL,
    "verifiedAt" TIMESTAMP(3),
    "flagReason" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "accounting_verifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "accounting_import_batches_source_idx" ON "accounting_import_batches"("source");

-- CreateIndex
CREATE INDEX "accounting_import_batches_importedAt_idx" ON "accounting_import_batches"("importedAt");

-- CreateIndex
CREATE INDEX "accounting_transactions_direction_idx" ON "accounting_transactions"("direction");

-- CreateIndex
CREATE INDEX "accounting_transactions_transactionDate_idx" ON "accounting_transactions"("transactionDate");

-- CreateIndex
CREATE INDEX "accounting_transactions_counterpartyName_idx" ON "accounting_transactions"("counterpartyName");

-- CreateIndex
CREATE INDEX "accounting_transactions_reconciliationStatus_idx" ON "accounting_transactions"("reconciliationStatus");

-- CreateIndex
CREATE INDEX "accounting_transactions_projectId_idx" ON "accounting_transactions"("projectId");

-- CreateIndex
CREATE INDEX "accounting_transactions_source_idx" ON "accounting_transactions"("source");

-- CreateIndex
CREATE INDEX "accounting_transactions_sourceTransactionId_idx" ON "accounting_transactions"("sourceTransactionId");

-- CreateIndex
CREATE INDEX "accounting_reconciliations_transactionId_idx" ON "accounting_reconciliations"("transactionId");

-- CreateIndex
CREATE INDEX "accounting_reconciliations_revenueRecordId_idx" ON "accounting_reconciliations"("revenueRecordId");

-- CreateIndex
CREATE INDEX "accounting_reconciliations_expenseRecordId_idx" ON "accounting_reconciliations"("expenseRecordId");

-- CreateIndex
CREATE INDEX "accounting_reconciliations_projectCode_idx" ON "accounting_reconciliations"("projectCode");

-- CreateIndex
CREATE INDEX "accounting_verifications_verificationType_idx" ON "accounting_verifications"("verificationType");

-- CreateIndex
CREATE INDEX "accounting_verifications_status_idx" ON "accounting_verifications"("status");

-- CreateIndex
CREATE INDEX "accounting_verifications_verifiedBy_idx" ON "accounting_verifications"("verifiedBy");

-- CreateIndex
CREATE UNIQUE INDEX "accounting_verifications_transactionId_verificationType_key" ON "accounting_verifications"("transactionId", "verificationType");

-- AddForeignKey
ALTER TABLE "accounting_import_batches" ADD CONSTRAINT "accounting_import_batches_importedBy_fkey" FOREIGN KEY ("importedBy") REFERENCES "master_staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounting_transactions" ADD CONSTRAINT "accounting_transactions_importBatchId_fkey" FOREIGN KEY ("importBatchId") REFERENCES "accounting_import_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounting_transactions" ADD CONSTRAINT "accounting_transactions_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "master_projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounting_reconciliations" ADD CONSTRAINT "accounting_reconciliations_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "accounting_transactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounting_reconciliations" ADD CONSTRAINT "accounting_reconciliations_revenueRecordId_fkey" FOREIGN KEY ("revenueRecordId") REFERENCES "stp_revenue_records"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounting_reconciliations" ADD CONSTRAINT "accounting_reconciliations_expenseRecordId_fkey" FOREIGN KEY ("expenseRecordId") REFERENCES "stp_expense_records"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounting_reconciliations" ADD CONSTRAINT "accounting_reconciliations_matchedBy_fkey" FOREIGN KEY ("matchedBy") REFERENCES "master_staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounting_verifications" ADD CONSTRAINT "accounting_verifications_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "accounting_transactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounting_verifications" ADD CONSTRAINT "accounting_verifications_verifiedBy_fkey" FOREIGN KEY ("verifiedBy") REFERENCES "master_staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
