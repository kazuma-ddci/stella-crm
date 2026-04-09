-- Add consultation (cl2) fields to slp_company_records
ALTER TABLE "slp_company_records"
  ADD COLUMN "consultation_status" VARCHAR(50),
  ADD COLUMN "consultation_booked_at" TIMESTAMP(3),
  ADD COLUMN "consultation_date" TIMESTAMP(3),
  ADD COLUMN "consultation_staff" VARCHAR(100),
  ADD COLUMN "consultation_staff_id" INTEGER,
  ADD COLUMN "consultation_changed_at" TIMESTAMP(3),
  ADD COLUMN "consultation_canceled_at" TIMESTAMP(3);

-- FK from consultation_staff_id to master_staff
ALTER TABLE "slp_company_records"
  ADD CONSTRAINT "slp_company_records_consultation_staff_id_fkey"
  FOREIGN KEY ("consultation_staff_id") REFERENCES "master_staff"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Add flow discriminator to status histories (briefing|consultation)
ALTER TABLE "slp_company_record_status_histories"
  ADD COLUMN "flow" VARCHAR(20) NOT NULL DEFAULT 'briefing';
