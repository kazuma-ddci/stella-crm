-- CreateTable
CREATE TABLE "slp_company_record_status_histories" (
    "id" SERIAL NOT NULL,
    "record_id" INTEGER NOT NULL,
    "from_status" VARCHAR(50),
    "to_status" VARCHAR(50),
    "reason" TEXT,
    "changed_by_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "slp_company_record_status_histories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "slp_company_record_status_histories_record_id_idx" ON "slp_company_record_status_histories"("record_id");

-- AddForeignKey
ALTER TABLE "slp_company_record_status_histories" ADD CONSTRAINT "slp_company_record_status_histories_record_id_fkey" FOREIGN KEY ("record_id") REFERENCES "slp_company_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "slp_company_record_status_histories" ADD CONSTRAINT "slp_company_record_status_histories_changed_by_id_fkey" FOREIGN KEY ("changed_by_id") REFERENCES "master_staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;
