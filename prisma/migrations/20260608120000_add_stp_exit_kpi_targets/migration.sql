-- CreateTable
CREATE TABLE "stp_exit_kpi_targets" (
    "id" SERIAL NOT NULL,
    "target_month" VARCHAR(7) NOT NULL,
    "current_mrr_target" INTEGER,
    "arr_run_rate_target" INTEGER,
    "nrr_target" DECIMAL(6,1),
    "churn_rate_target" DECIMAL(6,1),
    "gross_margin_target" DECIMAL(6,1),
    "ebitda_margin_target" DECIMAL(6,1),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stp_exit_kpi_targets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "stp_exit_kpi_targets_target_month_key" ON "stp_exit_kpi_targets"("target_month");

-- CreateIndex
CREATE INDEX "idx_stp_exit_kpi_targets_target_month" ON "stp_exit_kpi_targets"("target_month");
