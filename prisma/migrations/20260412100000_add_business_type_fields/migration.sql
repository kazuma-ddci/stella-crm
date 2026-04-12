-- SlpCompanyRecord: 事業形態・法人/個人事業主対応
ALTER TABLE "slp_company_records" ADD COLUMN "business_type" VARCHAR(20);
ALTER TABLE "slp_company_records" ADD COLUMN "corporate_number" VARCHAR(13);
ALTER TABLE "slp_company_records" ADD COLUMN "company_email" VARCHAR(255);
ALTER TABLE "slp_company_records" ADD COLUMN "representative_phone" VARCHAR(50);
ALTER TABLE "slp_company_records" ADD COLUMN "representative_email" VARCHAR(255);
ALTER TABLE "slp_company_records" ADD COLUMN "primary_contact_id" INT;

-- SlpCompanyRecord.primaryContactId -> SlpCompanyContact.id FK
ALTER TABLE "slp_company_records"
  ADD CONSTRAINT "slp_company_records_primary_contact_id_fkey"
  FOREIGN KEY ("primary_contact_id") REFERENCES "slp_company_contacts"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- SlpAgency: 事業形態・法人/個人事業主対応
ALTER TABLE "slp_agencies" ADD COLUMN "is_individual_business" BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE "slp_agencies" ADD COLUMN "corporate_number" VARCHAR(13);
ALTER TABLE "slp_agencies" ADD COLUMN "representative_name" VARCHAR(100);
ALTER TABLE "slp_agencies" ADD COLUMN "representative_phone" VARCHAR(50);
ALTER TABLE "slp_agencies" ADD COLUMN "representative_email" VARCHAR(255);

-- SlpReservationPending: 予約時の事業形態
ALTER TABLE "slp_reservation_pending" ADD COLUMN "business_type" VARCHAR(20);
