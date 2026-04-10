-- AlterTable: SlpCompanyRecord にマージ統合された予約ID配列カラムを追加
ALTER TABLE "slp_company_records" ADD COLUMN "merged_briefing_reservation_ids" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "slp_company_records" ADD COLUMN "merged_consultation_reservation_ids" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateTable: SlpCompanyDuplicateCandidate
CREATE TABLE "slp_company_duplicate_candidates" (
    "id" SERIAL NOT NULL,
    "record_id_a" INTEGER NOT NULL,
    "record_id_b" INTEGER NOT NULL,
    "reasons" TEXT[],
    "detected_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "slp_company_duplicate_candidates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "slp_company_duplicate_candidates_record_id_a_record_id_b_key" ON "slp_company_duplicate_candidates"("record_id_a", "record_id_b");
CREATE INDEX "slp_company_duplicate_candidates_record_id_a_idx" ON "slp_company_duplicate_candidates"("record_id_a");
CREATE INDEX "slp_company_duplicate_candidates_record_id_b_idx" ON "slp_company_duplicate_candidates"("record_id_b");

-- AddForeignKey
ALTER TABLE "slp_company_duplicate_candidates" ADD CONSTRAINT "slp_company_duplicate_candidates_record_id_a_fkey" FOREIGN KEY ("record_id_a") REFERENCES "slp_company_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "slp_company_duplicate_candidates" ADD CONSTRAINT "slp_company_duplicate_candidates_record_id_b_fkey" FOREIGN KEY ("record_id_b") REFERENCES "slp_company_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: SlpCompanyDuplicateExclusion
CREATE TABLE "slp_company_duplicate_exclusions" (
    "id" SERIAL NOT NULL,
    "record_id_a" INTEGER NOT NULL,
    "record_id_b" INTEGER NOT NULL,
    "excluded_by_id" INTEGER,
    "reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "slp_company_duplicate_exclusions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "slp_company_duplicate_exclusions_record_id_a_record_id_b_key" ON "slp_company_duplicate_exclusions"("record_id_a", "record_id_b");
CREATE INDEX "slp_company_duplicate_exclusions_record_id_a_idx" ON "slp_company_duplicate_exclusions"("record_id_a");
CREATE INDEX "slp_company_duplicate_exclusions_record_id_b_idx" ON "slp_company_duplicate_exclusions"("record_id_b");

-- AddForeignKey
ALTER TABLE "slp_company_duplicate_exclusions" ADD CONSTRAINT "slp_company_duplicate_exclusions_record_id_a_fkey" FOREIGN KEY ("record_id_a") REFERENCES "slp_company_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "slp_company_duplicate_exclusions" ADD CONSTRAINT "slp_company_duplicate_exclusions_record_id_b_fkey" FOREIGN KEY ("record_id_b") REFERENCES "slp_company_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "slp_company_duplicate_exclusions" ADD CONSTRAINT "slp_company_duplicate_exclusions_excluded_by_id_fkey" FOREIGN KEY ("excluded_by_id") REFERENCES "master_staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;
