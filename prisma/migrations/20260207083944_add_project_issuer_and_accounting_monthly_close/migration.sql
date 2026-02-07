-- AlterTable
ALTER TABLE "master_projects" ADD COLUMN     "address" TEXT,
ADD COLUMN     "bank_info" TEXT,
ADD COLUMN     "company_name" VARCHAR(200),
ADD COLUMN     "phone" VARCHAR(50),
ADD COLUMN     "postal_code" VARCHAR(10),
ADD COLUMN     "registration_number" VARCHAR(20),
ADD COLUMN     "representative_name" VARCHAR(100);

-- CreateTable
CREATE TABLE "accounting_monthly_closes" (
    "id" SERIAL NOT NULL,
    "targetMonth" DATE NOT NULL,
    "projectId" INTEGER NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'open',
    "projectClosedAt" TIMESTAMP(3),
    "projectClosedBy" INTEGER,
    "accountingClosedAt" TIMESTAMP(3),
    "accountingClosedBy" INTEGER,
    "reopenedAt" TIMESTAMP(3),
    "reopenedBy" INTEGER,
    "reopenReason" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "accounting_monthly_closes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "accounting_monthly_closes_targetMonth_idx" ON "accounting_monthly_closes"("targetMonth");

-- CreateIndex
CREATE INDEX "accounting_monthly_closes_projectId_idx" ON "accounting_monthly_closes"("projectId");

-- CreateIndex
CREATE INDEX "accounting_monthly_closes_status_idx" ON "accounting_monthly_closes"("status");

-- CreateIndex
CREATE UNIQUE INDEX "accounting_monthly_closes_targetMonth_projectId_key" ON "accounting_monthly_closes"("targetMonth", "projectId");

-- AddForeignKey
ALTER TABLE "accounting_monthly_closes" ADD CONSTRAINT "accounting_monthly_closes_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "master_projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounting_monthly_closes" ADD CONSTRAINT "accounting_monthly_closes_projectClosedBy_fkey" FOREIGN KEY ("projectClosedBy") REFERENCES "master_staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounting_monthly_closes" ADD CONSTRAINT "accounting_monthly_closes_accountingClosedBy_fkey" FOREIGN KEY ("accountingClosedBy") REFERENCES "master_staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounting_monthly_closes" ADD CONSTRAINT "accounting_monthly_closes_reopenedBy_fkey" FOREIGN KEY ("reopenedBy") REFERENCES "master_staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;
