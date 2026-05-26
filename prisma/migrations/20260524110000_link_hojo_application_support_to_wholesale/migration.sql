-- Rebuild HOJO application support records from security-cloud wholesale accounts.
-- Existing LINE-origin application support records are intentionally removed;
-- business-plan form submissions remain and their links are cleared by FK SET NULL.
DELETE FROM "hojo_application_supports";

ALTER TABLE "hojo_application_supports"
  ALTER COLUMN "lineFriendId" DROP NOT NULL,
  ADD COLUMN "wholesale_account_id" INTEGER,
  ADD COLUMN "form_token" VARCHAR(64),
  ADD COLUMN "form_update_status" VARCHAR(20) NOT NULL DEFAULT '未送信',
  ADD COLUMN "pending_answers" JSONB,
  ADD COLUMN "pending_file_urls" JSONB,
  ADD COLUMN "grant_usage_approved" VARCHAR(10),
  ADD COLUMN "grant_usage_pending" VARCHAR(10),
  ADD COLUMN "grant_usage_change_requested_at" TIMESTAMP(3);

CREATE UNIQUE INDEX "hojo_application_supports_wholesale_account_id_key"
  ON "hojo_application_supports"("wholesale_account_id");

CREATE UNIQUE INDEX "hojo_application_supports_form_token_key"
  ON "hojo_application_supports"("form_token");

CREATE INDEX "hojo_application_supports_wholesale_account_id_idx"
  ON "hojo_application_supports"("wholesale_account_id");

CREATE INDEX "hojo_application_supports_form_update_status_idx"
  ON "hojo_application_supports"("form_update_status");

CREATE INDEX "hojo_application_supports_grant_usage_pending_idx"
  ON "hojo_application_supports"("grant_usage_pending");

ALTER TABLE "hojo_application_supports"
  ADD CONSTRAINT "hojo_application_supports_wholesale_account_id_fkey"
  FOREIGN KEY ("wholesale_account_id") REFERENCES "hojo_wholesale_accounts"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "hojo_application_supports" (
  "wholesale_account_id",
  "vendorId",
  "applicantName",
  "subsidy_amount",
  "form_token",
  "form_update_status",
  "grant_usage_approved",
  "createdAt",
  "updatedAt"
)
SELECT
  w."id",
  w."vendor_id",
  w."company_name",
  COALESCE(w."application_amount", w."subsidy_target_amount_tax_included"),
  substr(
    md5(w."id"::text || '-' || clock_timestamp()::text || '-' || random()::text)
    || md5(random()::text || '-' || clock_timestamp()::text),
    1,
    64
  ),
  '未送信',
  '有',
  NOW(),
  NOW()
FROM "hojo_wholesale_accounts" w
WHERE w."grant_usage" = '有'
  AND w."deleted_at" IS NULL
  AND w."deleted_by_vendor" = false;
