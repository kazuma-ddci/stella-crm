-- CreateTable: 媒体広告
CREATE TABLE "stp_media_ads" (
    "id" SERIAL NOT NULL,
    "contractHistoryId" INTEGER NOT NULL,
    "adNumber" VARCHAR(20) NOT NULL,
    "adName" VARCHAR(200) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'active',
    "startDate" DATE,
    "endDate" DATE,
    "budgetLimit" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stp_media_ads_pkey" PRIMARY KEY ("id")
);

-- CreateTable: 広告日別データ
CREATE TABLE "stp_media_ad_daily_metrics" (
    "id" SERIAL NOT NULL,
    "adId" INTEGER NOT NULL,
    "date" DATE NOT NULL,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "applicationStarts" INTEGER NOT NULL DEFAULT 0,
    "applications" INTEGER NOT NULL DEFAULT 0,
    "cost" INTEGER NOT NULL DEFAULT 0,
    "ctr" DECIMAL(7,2),
    "applicationStartRate" DECIMAL(7,2),
    "applicationCompletionRate" DECIMAL(7,2),
    "applicationRate" DECIMAL(7,2),
    "cpc" INTEGER,
    "costPerApplicationStart" INTEGER,
    "cpa" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stp_media_ad_daily_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable: 広告内求人別データ
CREATE TABLE "stp_media_ad_job_postings" (
    "id" SERIAL NOT NULL,
    "adId" INTEGER NOT NULL,
    "jobNumber" VARCHAR(20) NOT NULL,
    "jobTitle" TEXT NOT NULL,
    "jobMemo" TEXT,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "applicationStarts" INTEGER NOT NULL DEFAULT 0,
    "applications" INTEGER NOT NULL DEFAULT 0,
    "cost" INTEGER NOT NULL DEFAULT 0,
    "ctr" DECIMAL(7,2),
    "applicationStartRate" DECIMAL(7,2),
    "applicationCompletionRate" DECIMAL(7,2),
    "applicationRate" DECIMAL(7,2),
    "cpc" INTEGER,
    "costPerApplicationStart" INTEGER,
    "cpa" INTEGER,
    "employmentType" VARCHAR(20),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stp_media_ad_job_postings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "stp_media_ads_adNumber_key" ON "stp_media_ads"("adNumber");
CREATE INDEX "idx_stp_media_ads_contract_history_id" ON "stp_media_ads"("contractHistoryId");

CREATE UNIQUE INDEX "stp_media_ad_daily_metrics_adId_date_key" ON "stp_media_ad_daily_metrics"("adId", "date");
CREATE INDEX "idx_stp_media_ad_daily_metrics_ad_id" ON "stp_media_ad_daily_metrics"("adId");

CREATE UNIQUE INDEX "stp_media_ad_job_postings_adId_jobNumber_key" ON "stp_media_ad_job_postings"("adId", "jobNumber");
CREATE INDEX "idx_stp_media_ad_job_postings_ad_id" ON "stp_media_ad_job_postings"("adId");

-- AddForeignKey
ALTER TABLE "stp_media_ads" ADD CONSTRAINT "stp_media_ads_contractHistoryId_fkey" FOREIGN KEY ("contractHistoryId") REFERENCES "stp_contract_histories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "stp_media_ad_daily_metrics" ADD CONSTRAINT "stp_media_ad_daily_metrics_adId_fkey" FOREIGN KEY ("adId") REFERENCES "stp_media_ads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "stp_media_ad_job_postings" ADD CONSTRAINT "stp_media_ad_job_postings_adId_fkey" FOREIGN KEY ("adId") REFERENCES "stp_media_ads"("id") ON DELETE CASCADE ON UPDATE CASCADE;
