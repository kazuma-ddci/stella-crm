-- AlterTable: SlpCompanyRecord に予約IDフィールドを追加
ALTER TABLE "slp_company_records" ADD COLUMN "reservation_id" VARCHAR(100);
ALTER TABLE "slp_company_records" ADD COLUMN "consultation_reservation_id" VARCHAR(100);

-- CreateIndex
CREATE INDEX "slp_company_records_reservation_id_idx" ON "slp_company_records"("reservation_id");
CREATE INDEX "slp_company_records_consultation_reservation_id_idx" ON "slp_company_records"("consultation_reservation_id");

-- CreateTable: SlpReservationPending
CREATE TABLE "slp_reservation_pending" (
    "id" SERIAL NOT NULL,
    "token" VARCHAR(64) NOT NULL,
    "uid" VARCHAR(100) NOT NULL,
    "reservation_type" VARCHAR(20) NOT NULL,
    "company_record_ids" INTEGER[],
    "new_company_name" VARCHAR(500),
    "expected_company_name" VARCHAR(500) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "consumed_at" TIMESTAMP(3),
    "consumed_reservation_id" VARCHAR(100),

    CONSTRAINT "slp_reservation_pending_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "slp_reservation_pending_token_key" ON "slp_reservation_pending"("token");
CREATE INDEX "slp_reservation_pending_token_idx" ON "slp_reservation_pending"("token");
CREATE INDEX "slp_reservation_pending_uid_created_at_idx" ON "slp_reservation_pending"("uid", "created_at");
CREATE INDEX "slp_reservation_pending_expires_at_idx" ON "slp_reservation_pending"("expires_at");
