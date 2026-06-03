ALTER TABLE "hojo_proline_accounts"
  ADD COLUMN "last_sync_succeeded_at" TIMESTAMP(3),
  ADD COLUMN "last_sync_failed_at" TIMESTAMP(3),
  ADD COLUMN "last_sync_error_message" VARCHAR(2000),
  ADD COLUMN "last_sync_attempt_count" INTEGER NOT NULL DEFAULT 0;

