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
CREATE UNIQUE INDEX "system_project_bindings_routeKey_key" ON "system_project_bindings"("routeKey");

-- AddForeignKey
ALTER TABLE "system_project_bindings" ADD CONSTRAINT "system_project_bindings_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "master_projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "system_project_bindings" ADD CONSTRAINT "system_project_bindings_defaultCostCenterId_fkey" FOREIGN KEY ("defaultCostCenterId") REFERENCES "CostCenter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "system_project_bindings" ADD CONSTRAINT "system_project_bindings_operatingCompanyId_fkey" FOREIGN KEY ("operatingCompanyId") REFERENCES "operating_companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
