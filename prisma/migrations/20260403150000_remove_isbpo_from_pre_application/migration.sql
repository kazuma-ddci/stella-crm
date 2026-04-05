-- AlterTable: Remove is_bpo column from hojo_grant_customer_pre_applications
ALTER TABLE "hojo_grant_customer_pre_applications" DROP COLUMN IF EXISTS "is_bpo";
