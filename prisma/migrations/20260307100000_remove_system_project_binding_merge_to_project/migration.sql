-- AlterTable: MasterProjectにdefaultCostCenterIdカラムを追加
ALTER TABLE "master_projects" ADD COLUMN "default_cost_center_id" INTEGER;

-- AddForeignKey
ALTER TABLE "master_projects" ADD CONSTRAINT "master_projects_default_cost_center_id_fkey" FOREIGN KEY ("default_cost_center_id") REFERENCES "CostCenter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- MigrateData: SystemProjectBindingのデータをMasterProjectに移行
UPDATE "master_projects" mp
SET "default_cost_center_id" = spb."defaultCostCenterId"
FROM "system_project_bindings" spb
WHERE mp."id" = spb."projectId"
  AND spb."defaultCostCenterId" IS NOT NULL;

-- DropForeignKey
ALTER TABLE "system_project_bindings" DROP CONSTRAINT "system_project_bindings_projectId_fkey";

-- DropForeignKey
ALTER TABLE "system_project_bindings" DROP CONSTRAINT "system_project_bindings_defaultCostCenterId_fkey";

-- DropForeignKey
ALTER TABLE "system_project_bindings" DROP CONSTRAINT "system_project_bindings_operatingCompanyId_fkey";

-- DropTable
DROP TABLE "system_project_bindings";
