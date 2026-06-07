-- CreateTable
CREATE TABLE "stp_dashboard_funnel_targets" (
    "id" SERIAL NOT NULL,
    "target_month" VARCHAR(7) NOT NULL,
    "product_key" VARCHAR(50) NOT NULL,
    "product_name" VARCHAR(100) NOT NULL,
    "product_id" INTEGER,
    "staff_key" VARCHAR(50) NOT NULL,
    "staff_name" VARCHAR(100) NOT NULL,
    "sales_staff_id" INTEGER,
    "lead_target" INTEGER,
    "valid_lead_target" INTEGER,
    "meeting_target" INTEGER,
    "pending_target" INTEGER,
    "contract_target" INTEGER,
    "lost_target" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stp_dashboard_funnel_targets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "stp_dashboard_funnel_targets_month_product_staff_key" ON "stp_dashboard_funnel_targets"("target_month", "product_key", "staff_key");

-- CreateIndex
CREATE INDEX "idx_stp_dashboard_funnel_targets_target_month" ON "stp_dashboard_funnel_targets"("target_month");

-- CreateIndex
CREATE INDEX "idx_stp_dashboard_funnel_targets_product_id" ON "stp_dashboard_funnel_targets"("product_id");

-- CreateIndex
CREATE INDEX "idx_stp_dashboard_funnel_targets_sales_staff_id" ON "stp_dashboard_funnel_targets"("sales_staff_id");

-- AddForeignKey
ALTER TABLE "stp_dashboard_funnel_targets" ADD CONSTRAINT "stp_dashboard_funnel_targets_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "stp_products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stp_dashboard_funnel_targets" ADD CONSTRAINT "stp_dashboard_funnel_targets_sales_staff_id_fkey" FOREIGN KEY ("sales_staff_id") REFERENCES "master_staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;
