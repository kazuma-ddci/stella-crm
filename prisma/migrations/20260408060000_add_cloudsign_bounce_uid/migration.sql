-- AlterTable
ALTER TABLE "OperatingCompanyEmail"
  ADD COLUMN "last_checked_cloudsign_bounce_uid" INTEGER NOT NULL DEFAULT 0;
