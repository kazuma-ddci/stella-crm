-- CreateTable
CREATE TABLE "stp_lost_reason_options" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stp_lost_reason_options_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "stp_lost_reason_options_name_key" ON "stp_lost_reason_options"("name");

-- AlterTable
ALTER TABLE "stp_companies" ADD COLUMN "lost_reason_option_id" INTEGER;

-- AlterTable
ALTER TABLE "stp_stage_histories" ADD COLUMN "lost_reason_option_id" INTEGER;

-- CreateIndex
CREATE INDEX "idx_stp_companies_lost_reason_option_id" ON "stp_companies"("lost_reason_option_id");

-- CreateIndex
CREATE INDEX "idx_stp_stage_histories_lost_reason_option_id" ON "stp_stage_histories"("lost_reason_option_id");

-- AddForeignKey
ALTER TABLE "stp_companies" ADD CONSTRAINT "stp_companies_lost_reason_option_id_fkey" FOREIGN KEY ("lost_reason_option_id") REFERENCES "stp_lost_reason_options"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stp_stage_histories" ADD CONSTRAINT "stp_stage_histories_lost_reason_option_id_fkey" FOREIGN KEY ("lost_reason_option_id") REFERENCES "stp_lost_reason_options"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- SeedData
INSERT INTO "stp_lost_reason_options" ("name", "display_order", "is_active", "updated_at")
VALUES
  ('価格', 1, true, CURRENT_TIMESTAMP),
  ('タイミング', 2, true, CURRENT_TIMESTAMP),
  ('競合', 3, true, CURRENT_TIMESTAMP),
  ('決裁不在', 4, true, CURRENT_TIMESTAMP),
  ('課題なし', 5, true, CURRENT_TIMESTAMP),
  ('連絡つかず', 6, true, CURRENT_TIMESTAMP)
ON CONFLICT ("name") DO NOTHING;
