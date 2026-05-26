CREATE TABLE "hojo_application_bpo_requests" (
  "id" SERIAL NOT NULL,
  "vendor_id" INTEGER NOT NULL,
  "vendor_customer_no" INTEGER NOT NULL,
  "request_date" TIMESTAMP(3),
  "double_check_status" VARCHAR(20),
  "scheduled_at" VARCHAR(100),
  "company_name" VARCHAR(255),
  "applicant_type" VARCHAR(20),
  "repeat_type" VARCHAR(20),
  "wage_increase_availability" VARCHAR(20),
  "completion_date" TIMESTAMP(3),
  "next_action" TEXT,
  "vendor_input" JSONB NOT NULL DEFAULT '{}',
  "staff_input" JSONB NOT NULL DEFAULT '{}',
  "attachments" JSONB NOT NULL DEFAULT '{}',
  "staff_memo" TEXT,
  "deleted_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "hojo_application_bpo_requests_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "hojo_application_bpo_requests_vendor_id_vendor_customer_no_key"
  ON "hojo_application_bpo_requests"("vendor_id", "vendor_customer_no");

CREATE INDEX "hojo_application_bpo_requests_vendor_id_idx"
  ON "hojo_application_bpo_requests"("vendor_id");

CREATE INDEX "hojo_application_bpo_requests_deleted_at_idx"
  ON "hojo_application_bpo_requests"("deleted_at");

ALTER TABLE "hojo_application_bpo_requests"
  ADD CONSTRAINT "hojo_application_bpo_requests_vendor_id_fkey"
  FOREIGN KEY ("vendor_id") REFERENCES "hojo_vendors"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
