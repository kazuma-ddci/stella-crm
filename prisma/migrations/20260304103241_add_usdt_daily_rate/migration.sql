-- CreateTable
CREATE TABLE "usdt_daily_rates" (
    "id" SERIAL NOT NULL,
    "date" DATE NOT NULL,
    "rate" DECIMAL(12,4) NOT NULL,
    "source" VARCHAR(50) NOT NULL DEFAULT 'coingecko',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usdt_daily_rates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "usdt_daily_rates_date_key" ON "usdt_daily_rates"("date");
