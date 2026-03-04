-- CreateTable
CREATE TABLE "kpi_monthly_targets" (
    "id" SERIAL NOT NULL,
    "yearMonth" VARCHAR(7) NOT NULL,
    "kpiKey" VARCHAR(50) NOT NULL,
    "targetValue" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "kpi_monthly_targets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "kpi_monthly_targets_yearMonth_kpiKey_key" ON "kpi_monthly_targets"("yearMonth", "kpiKey");
