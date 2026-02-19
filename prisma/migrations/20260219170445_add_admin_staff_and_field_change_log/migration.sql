-- AlterTable
ALTER TABLE "stp_agents" ADD COLUMN     "adminStaffId" INTEGER;

-- AlterTable
ALTER TABLE "stp_companies" ADD COLUMN     "adminStaffId" INTEGER;

-- CreateTable
CREATE TABLE "field_change_logs" (
    "id" SERIAL NOT NULL,
    "entityType" VARCHAR(50) NOT NULL,
    "entityId" INTEGER NOT NULL,
    "fieldName" VARCHAR(50) NOT NULL,
    "displayName" VARCHAR(100) NOT NULL,
    "oldValue" TEXT,
    "newValue" TEXT,
    "note" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "field_change_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "field_change_logs_entityType_entityId_idx" ON "field_change_logs"("entityType", "entityId");

-- AddForeignKey
ALTER TABLE "stp_agents" ADD CONSTRAINT "stp_agents_adminStaffId_fkey" FOREIGN KEY ("adminStaffId") REFERENCES "master_staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stp_companies" ADD CONSTRAINT "stp_companies_adminStaffId_fkey" FOREIGN KEY ("adminStaffId") REFERENCES "master_staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;
