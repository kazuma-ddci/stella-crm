ALTER TABLE "slp_company_records"
ADD COLUMN "initial_documents_completed_at" TIMESTAMP(3),
ADD COLUMN "initial_documents_completed_by_uid" VARCHAR(100),
ADD COLUMN "initial_documents_completed_by_name" VARCHAR(200);
