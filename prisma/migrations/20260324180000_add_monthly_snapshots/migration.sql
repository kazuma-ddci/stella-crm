-- CreateTable
CREATE TABLE "monthly_snapshots" (
    "id" SERIAL NOT NULL,
    "year_month" VARCHAR(7) NOT NULL,
    "snapshot_key" VARCHAR(50) NOT NULL,
    "value" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "monthly_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "monthly_snapshots_year_month_snapshot_key_key" ON "monthly_snapshots"("year_month", "snapshot_key");
