-- CreateTable
CREATE TABLE "hojo_loan_progress_statuses" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hojo_loan_progress_statuses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hojo_loan_progresses" (
    "id" SERIAL NOT NULL,
    "formSubmissionId" INTEGER NOT NULL,
    "vendorId" INTEGER NOT NULL,
    "companyName" VARCHAR(255),
    "representName" VARCHAR(255),
    "loanAmount" DECIMAL(14,0),
    "applicantType" VARCHAR(20),
    "requestDate" TIMESTAMP(3),
    "toolPurchasePrice" DECIMAL(14,0),
    "fundTransferDate" TIMESTAMP(3),
    "loanExecutionDate" TIMESTAMP(3),
    "statusId" INTEGER,
    "memo" TEXT,
    "memorandum" TEXT,
    "funds" TEXT,
    "repaymentDate" TIMESTAMP(3),
    "repaymentAmount" DECIMAL(14,0),
    "principalAmount" DECIMAL(14,0),
    "interestAmount" DECIMAL(14,0),
    "overshortAmount" DECIMAL(14,0),
    "operationFee" DECIMAL(14,0),
    "redemptionAmount" DECIMAL(14,0),
    "redemptionDate" TIMESTAMP(3),
    "endMemo" TEXT,
    "staffMemo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "hojo_loan_progresses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "hojo_loan_progresses_formSubmissionId_key" ON "hojo_loan_progresses"("formSubmissionId");

-- CreateIndex
CREATE INDEX "hojo_loan_progresses_vendorId_idx" ON "hojo_loan_progresses"("vendorId");

-- AddForeignKey
ALTER TABLE "hojo_loan_progresses" ADD CONSTRAINT "hojo_loan_progresses_formSubmissionId_fkey" FOREIGN KEY ("formSubmissionId") REFERENCES "hojo_form_submissions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hojo_loan_progresses" ADD CONSTRAINT "hojo_loan_progresses_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "hojo_vendors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hojo_loan_progresses" ADD CONSTRAINT "hojo_loan_progresses_statusId_fkey" FOREIGN KEY ("statusId") REFERENCES "hojo_loan_progress_statuses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Seed default statuses
INSERT INTO "hojo_loan_progress_statuses" ("name", "displayOrder", "updatedAt") VALUES
  ('融資稟議確認中', 1, CURRENT_TIMESTAMP),
  ('契約書送付前', 2, CURRENT_TIMESTAMP),
  ('契約書返送待ち', 3, CURRENT_TIMESTAMP),
  ('契約完了', 4, CURRENT_TIMESTAMP),
  ('融資実行待ち', 5, CURRENT_TIMESTAMP),
  ('返済待ち', 6, CURRENT_TIMESTAMP),
  ('終了', 7, CURRENT_TIMESTAMP);
