-- AlterTable
ALTER TABLE "stp_agents" ADD COLUMN     "isIndividualBusiness" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "withholdingTaxRate" DECIMAL(5,2);

-- AlterTable
ALTER TABLE "stp_companies" ADD COLUMN     "closingDay" INTEGER,
ADD COLUMN     "paymentDueDays" INTEGER,
ADD COLUMN     "paymentDueFixedDay" INTEGER,
ADD COLUMN     "paymentDueType" VARCHAR(20);

-- AlterTable
ALTER TABLE "stp_expense_records" ADD COLUMN     "appliedCommissionRate" DECIMAL(5,2),
ADD COLUMN     "appliedCommissionType" VARCHAR(10),
ADD COLUMN     "isWithholdingTarget" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "netPaymentAmount" INTEGER,
ADD COLUMN     "withholdingTaxAmount" INTEGER,
ADD COLUMN     "withholdingTaxRate" DECIMAL(5,2);

-- AlterTable
ALTER TABLE "stp_finance_edit_logs" ADD COLUMN     "editedBy" INTEGER;

-- AlterTable
ALTER TABLE "stp_invoices" ADD COLUMN     "invoiceType" VARCHAR(20) NOT NULL DEFAULT 'standard',
ADD COLUMN     "issuerId" INTEGER,
ADD COLUMN     "netPaymentAmount" INTEGER,
ADD COLUMN     "originalInvoiceId" INTEGER,
ADD COLUMN     "registrationNumber" VARCHAR(20),
ADD COLUMN     "subtotalByTaxRate" JSONB,
ADD COLUMN     "withholdingTaxAmount" INTEGER;

-- AlterTable
ALTER TABLE "stp_revenue_records" ADD COLUMN     "approvedAt" TIMESTAMP(3),
ADD COLUMN     "approvedBy" INTEGER;

-- CreateTable
CREATE TABLE "stp_invoice_issuers" (
    "id" SERIAL NOT NULL,
    "companyName" VARCHAR(200) NOT NULL,
    "registrationNumber" VARCHAR(20) NOT NULL,
    "postalCode" VARCHAR(10),
    "address" TEXT,
    "representativeName" VARCHAR(100),
    "phone" VARCHAR(50),
    "bankInfo" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stp_invoice_issuers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stp_invoice_line_items" (
    "id" SERIAL NOT NULL,
    "invoiceId" INTEGER NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "description" VARCHAR(500) NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitPrice" INTEGER NOT NULL,
    "amount" INTEGER NOT NULL,
    "taxRate" INTEGER NOT NULL DEFAULT 10,
    "taxRateCategory" VARCHAR(20) NOT NULL DEFAULT 'standard',
    "revenueRecordId" INTEGER,
    "expenseRecordId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stp_invoice_line_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stp_payment_transactions" (
    "id" SERIAL NOT NULL,
    "direction" VARCHAR(20) NOT NULL,
    "transactionDate" DATE NOT NULL,
    "amount" INTEGER NOT NULL,
    "counterpartyName" VARCHAR(200),
    "bankAccountName" VARCHAR(100),
    "accountCode" VARCHAR(20),
    "accountName" VARCHAR(100),
    "subAccountCode" VARCHAR(20),
    "subAccountName" VARCHAR(100),
    "freeeTransactionId" VARCHAR(100),
    "freeeDealId" VARCHAR(100),
    "freeeSyncedAt" TIMESTAMP(3),
    "withholdingTaxAmount" INTEGER,
    "status" VARCHAR(20) NOT NULL DEFAULT 'unmatched',
    "processedBy" INTEGER,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "stp_payment_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stp_payment_allocations" (
    "id" SERIAL NOT NULL,
    "paymentTransactionId" INTEGER NOT NULL,
    "revenueRecordId" INTEGER,
    "expenseRecordId" INTEGER,
    "allocatedAmount" INTEGER NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stp_payment_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stp_monthly_closes" (
    "id" SERIAL NOT NULL,
    "targetMonth" DATE NOT NULL,
    "closedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedBy" INTEGER NOT NULL,
    "reopenedAt" TIMESTAMP(3),
    "reopenedBy" INTEGER,
    "reopenReason" TEXT,
    "note" TEXT,

    CONSTRAINT "stp_monthly_closes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stp_invoice_number_sequences" (
    "id" SERIAL NOT NULL,
    "yearMonth" VARCHAR(7) NOT NULL,
    "lastNumber" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stp_invoice_number_sequences_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "stp_invoice_issuers_registrationNumber_key" ON "stp_invoice_issuers"("registrationNumber");

-- CreateIndex
CREATE INDEX "stp_invoice_line_items_invoiceId_idx" ON "stp_invoice_line_items"("invoiceId");

-- CreateIndex
CREATE INDEX "stp_payment_transactions_direction_idx" ON "stp_payment_transactions"("direction");

-- CreateIndex
CREATE INDEX "stp_payment_transactions_transactionDate_idx" ON "stp_payment_transactions"("transactionDate");

-- CreateIndex
CREATE INDEX "stp_payment_transactions_status_idx" ON "stp_payment_transactions"("status");

-- CreateIndex
CREATE INDEX "stp_payment_transactions_transactionDate_direction_idx" ON "stp_payment_transactions"("transactionDate", "direction");

-- CreateIndex
CREATE INDEX "stp_payment_allocations_paymentTransactionId_idx" ON "stp_payment_allocations"("paymentTransactionId");

-- CreateIndex
CREATE INDEX "stp_payment_allocations_revenueRecordId_idx" ON "stp_payment_allocations"("revenueRecordId");

-- CreateIndex
CREATE INDEX "stp_payment_allocations_expenseRecordId_idx" ON "stp_payment_allocations"("expenseRecordId");

-- CreateIndex
CREATE UNIQUE INDEX "stp_monthly_closes_targetMonth_key" ON "stp_monthly_closes"("targetMonth");

-- CreateIndex
CREATE UNIQUE INDEX "stp_invoice_number_sequences_yearMonth_key" ON "stp_invoice_number_sequences"("yearMonth");

-- AddForeignKey
ALTER TABLE "stp_revenue_records" ADD CONSTRAINT "stp_revenue_records_approvedBy_fkey" FOREIGN KEY ("approvedBy") REFERENCES "master_staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stp_invoices" ADD CONSTRAINT "stp_invoices_issuerId_fkey" FOREIGN KEY ("issuerId") REFERENCES "stp_invoice_issuers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stp_invoices" ADD CONSTRAINT "stp_invoices_originalInvoiceId_fkey" FOREIGN KEY ("originalInvoiceId") REFERENCES "stp_invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stp_finance_edit_logs" ADD CONSTRAINT "stp_finance_edit_logs_editedBy_fkey" FOREIGN KEY ("editedBy") REFERENCES "master_staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stp_invoice_line_items" ADD CONSTRAINT "stp_invoice_line_items_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "stp_invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stp_invoice_line_items" ADD CONSTRAINT "stp_invoice_line_items_revenueRecordId_fkey" FOREIGN KEY ("revenueRecordId") REFERENCES "stp_revenue_records"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stp_invoice_line_items" ADD CONSTRAINT "stp_invoice_line_items_expenseRecordId_fkey" FOREIGN KEY ("expenseRecordId") REFERENCES "stp_expense_records"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stp_payment_transactions" ADD CONSTRAINT "stp_payment_transactions_processedBy_fkey" FOREIGN KEY ("processedBy") REFERENCES "master_staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stp_payment_allocations" ADD CONSTRAINT "stp_payment_allocations_paymentTransactionId_fkey" FOREIGN KEY ("paymentTransactionId") REFERENCES "stp_payment_transactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stp_payment_allocations" ADD CONSTRAINT "stp_payment_allocations_revenueRecordId_fkey" FOREIGN KEY ("revenueRecordId") REFERENCES "stp_revenue_records"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stp_payment_allocations" ADD CONSTRAINT "stp_payment_allocations_expenseRecordId_fkey" FOREIGN KEY ("expenseRecordId") REFERENCES "stp_expense_records"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stp_monthly_closes" ADD CONSTRAINT "stp_monthly_closes_closedBy_fkey" FOREIGN KEY ("closedBy") REFERENCES "master_staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stp_monthly_closes" ADD CONSTRAINT "stp_monthly_closes_reopenedBy_fkey" FOREIGN KEY ("reopenedBy") REFERENCES "master_staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;
