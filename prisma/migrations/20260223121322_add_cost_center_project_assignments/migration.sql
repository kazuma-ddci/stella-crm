-- CreateTable
CREATE TABLE "cost_center_project_assignments" (
    "id" SERIAL NOT NULL,
    "costCenterId" INTEGER NOT NULL,
    "projectId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cost_center_project_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "cost_center_project_assignments_costCenterId_projectId_key" ON "cost_center_project_assignments"("costCenterId", "projectId");

-- AddForeignKey
ALTER TABLE "cost_center_project_assignments" ADD CONSTRAINT "cost_center_project_assignments_costCenterId_fkey" FOREIGN KEY ("costCenterId") REFERENCES "CostCenter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cost_center_project_assignments" ADD CONSTRAINT "cost_center_project_assignments_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "master_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: 既存 CostCenter.projectId → 中間テーブルへ移行
INSERT INTO "cost_center_project_assignments" ("costCenterId", "projectId", "createdAt")
SELECT "id", "projectId", NOW()
FROM "CostCenter"
WHERE "projectId" IS NOT NULL
  AND "deletedAt" IS NULL
ON CONFLICT ("costCenterId", "projectId") DO NOTHING;
