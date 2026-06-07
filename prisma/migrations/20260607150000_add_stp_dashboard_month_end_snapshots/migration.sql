-- CreateTable
CREATE TABLE "stp_dashboard_month_end_snapshots" (
    "id" SERIAL NOT NULL,
    "target_month" VARCHAR(7) NOT NULL,
    "product_key" VARCHAR(50) NOT NULL,
    "product_name" VARCHAR(100) NOT NULL,
    "product_id" INTEGER,
    "staff_key" VARCHAR(50) NOT NULL,
    "staff_name" VARCHAR(100) NOT NULL,
    "sales_staff_id" INTEGER,
    "snapshot_data" JSONB NOT NULL,
    "captured_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stp_dashboard_month_end_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "stp_dashboard_month_end_snapshots_month_product_staff_key" ON "stp_dashboard_month_end_snapshots"("target_month", "product_key", "staff_key");

-- CreateIndex
CREATE INDEX "idx_stp_dashboard_month_end_snapshots_target_month" ON "stp_dashboard_month_end_snapshots"("target_month");

-- CreateIndex
CREATE INDEX "idx_stp_dashboard_month_end_snapshots_product_id" ON "stp_dashboard_month_end_snapshots"("product_id");

-- CreateIndex
CREATE INDEX "idx_stp_dashboard_month_end_snapshots_sales_staff_id" ON "stp_dashboard_month_end_snapshots"("sales_staff_id");

-- AddForeignKey
ALTER TABLE "stp_dashboard_month_end_snapshots" ADD CONSTRAINT "stp_dashboard_month_end_snapshots_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "stp_products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stp_dashboard_month_end_snapshots" ADD CONSTRAINT "stp_dashboard_month_end_snapshots_sales_staff_id_fkey" FOREIGN KEY ("sales_staff_id") REFERENCES "master_staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;
