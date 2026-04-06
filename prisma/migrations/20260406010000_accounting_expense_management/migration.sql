-- 経理ブラッシュアップ：
--   - MasterProject.defaultApproverStaffId（既定承認者）
--   - PaymentGroup.approverStaffId / approvedAt（経理承認フロー）
--   - RecurringTransaction: intervalCount / executeOnLastDay / approverStaffId / frequency='once' 許可
--   - RecurringTransactionExpenseOwner（担当者複数）
--   - BankTransactionGroupLink（入出金↔グループ 多対多）

-- ============================================
-- MasterProject: defaultApproverStaffId
-- ============================================
ALTER TABLE "master_projects"
  ADD COLUMN "default_approver_staff_id" INTEGER;

ALTER TABLE "master_projects"
  ADD CONSTRAINT "master_projects_default_approver_staff_id_fkey"
  FOREIGN KEY ("default_approver_staff_id") REFERENCES "master_staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ============================================
-- PaymentGroup: approverStaffId / approvedAt
-- ============================================
ALTER TABLE "PaymentGroup"
  ADD COLUMN "approverStaffId" INTEGER,
  ADD COLUMN "approvedAt" TIMESTAMP(3);

ALTER TABLE "PaymentGroup"
  ADD CONSTRAINT "PaymentGroup_approverStaffId_fkey"
  FOREIGN KEY ("approverStaffId") REFERENCES "master_staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "PaymentGroup_approverStaffId_idx" ON "PaymentGroup"("approverStaffId");

-- ============================================
-- RecurringTransaction: intervalCount / executeOnLastDay / approverStaffId
-- ============================================
ALTER TABLE "RecurringTransaction"
  ADD COLUMN "intervalCount" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "executeOnLastDay" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "approverStaffId" INTEGER;

ALTER TABLE "RecurringTransaction"
  ADD CONSTRAINT "RecurringTransaction_approverStaffId_fkey"
  FOREIGN KEY ("approverStaffId") REFERENCES "master_staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "RecurringTransaction_approverStaffId_idx" ON "RecurringTransaction"("approverStaffId");

-- ============================================
-- RecurringTransactionExpenseOwner（担当者複数）
-- ============================================
CREATE TABLE "RecurringTransactionExpenseOwner" (
  "id" SERIAL NOT NULL,
  "recurringTransactionId" INTEGER NOT NULL,
  "staffId" INTEGER,
  "customName" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "RecurringTransactionExpenseOwner_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RecurringTransactionExpenseOwner_recurringTransactionId_staffId_key"
  ON "RecurringTransactionExpenseOwner"("recurringTransactionId", "staffId");

CREATE INDEX "RecurringTransactionExpenseOwner_recurringTransactionId_idx"
  ON "RecurringTransactionExpenseOwner"("recurringTransactionId");

ALTER TABLE "RecurringTransactionExpenseOwner"
  ADD CONSTRAINT "RecurringTransactionExpenseOwner_recurringTransactionId_fkey"
  FOREIGN KEY ("recurringTransactionId") REFERENCES "RecurringTransaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RecurringTransactionExpenseOwner"
  ADD CONSTRAINT "RecurringTransactionExpenseOwner_staffId_fkey"
  FOREIGN KEY ("staffId") REFERENCES "master_staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ============================================
-- BankTransactionGroupLink（入出金↔グループ 多対多）
-- ============================================
CREATE TABLE "BankTransactionGroupLink" (
  "id" SERIAL NOT NULL,
  "bankTransactionId" INTEGER NOT NULL,
  "invoiceGroupId" INTEGER,
  "paymentGroupId" INTEGER,
  "amount" INTEGER NOT NULL,
  "note" TEXT,
  "createdBy" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "BankTransactionGroupLink_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "BankTransactionGroupLink_bankTransactionId_idx" ON "BankTransactionGroupLink"("bankTransactionId");
CREATE INDEX "BankTransactionGroupLink_invoiceGroupId_idx"    ON "BankTransactionGroupLink"("invoiceGroupId");
CREATE INDEX "BankTransactionGroupLink_paymentGroupId_idx"    ON "BankTransactionGroupLink"("paymentGroupId");

ALTER TABLE "BankTransactionGroupLink"
  ADD CONSTRAINT "BankTransactionGroupLink_bankTransactionId_fkey"
  FOREIGN KEY ("bankTransactionId") REFERENCES "BankTransaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BankTransactionGroupLink"
  ADD CONSTRAINT "BankTransactionGroupLink_invoiceGroupId_fkey"
  FOREIGN KEY ("invoiceGroupId") REFERENCES "InvoiceGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BankTransactionGroupLink"
  ADD CONSTRAINT "BankTransactionGroupLink_paymentGroupId_fkey"
  FOREIGN KEY ("paymentGroupId") REFERENCES "PaymentGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BankTransactionGroupLink"
  ADD CONSTRAINT "BankTransactionGroupLink_createdBy_fkey"
  FOREIGN KEY ("createdBy") REFERENCES "master_staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ============================================
-- 既存の BankTransaction.invoiceGroupId/paymentGroupId の直接FKから
-- BankTransactionGroupLink へデータ移行
-- （既存FKカラムは一旦残す：後続フェーズで削除予定。1:1で消込済みのものは多対多にも反映）
-- ============================================
INSERT INTO "BankTransactionGroupLink" ("bankTransactionId", "invoiceGroupId", "amount", "createdBy", "createdAt")
SELECT
  bt."id",
  bt."invoiceGroupId",
  bt."amount",
  bt."createdBy",
  bt."createdAt"
FROM "BankTransaction" bt
WHERE bt."invoiceGroupId" IS NOT NULL AND bt."deletedAt" IS NULL;

INSERT INTO "BankTransactionGroupLink" ("bankTransactionId", "paymentGroupId", "amount", "createdBy", "createdAt")
SELECT
  bt."id",
  bt."paymentGroupId",
  bt."amount",
  bt."createdBy",
  bt."createdAt"
FROM "BankTransaction" bt
WHERE bt."paymentGroupId" IS NOT NULL AND bt."deletedAt" IS NULL;
