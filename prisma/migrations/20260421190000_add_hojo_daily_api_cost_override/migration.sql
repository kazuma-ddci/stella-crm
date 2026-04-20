-- CreateTable
CREATE TABLE "hojo_daily_api_cost_overrides" (
    "id" SERIAL NOT NULL,
    "date" DATE NOT NULL,
    "overridden_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "overridden_by_staff_id" INTEGER,
    "reason" TEXT,

    CONSTRAINT "hojo_daily_api_cost_overrides_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "hojo_daily_api_cost_overrides_date_key" ON "hojo_daily_api_cost_overrides"("date");

-- AddForeignKey
ALTER TABLE "hojo_daily_api_cost_overrides" ADD CONSTRAINT "hojo_daily_api_cost_overrides_overridden_by_staff_id_fkey" FOREIGN KEY ("overridden_by_staff_id") REFERENCES "master_staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;
