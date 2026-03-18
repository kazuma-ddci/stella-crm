-- AlterTable: SlpMember にフォーム関連カラムを追加
-- contractSentDate/contractSignedDate を DATE → TIMESTAMP に変更（分単位の精度が必要）

-- 1. 既存の DATE カラムを TIMESTAMP に変更
ALTER TABLE "slp_members" ALTER COLUMN "contractSentDate" TYPE TIMESTAMP(3) USING "contractSentDate"::timestamp(3);
ALTER TABLE "slp_members" ALTER COLUMN "contractSignedDate" TYPE TIMESTAMP(3) USING "contractSignedDate"::timestamp(3);

-- 2. 新規カラム追加
ALTER TABLE "slp_members" ADD COLUMN "formSubmittedAt" TIMESTAMP(3);
ALTER TABLE "slp_members" ADD COLUMN "lastReminderSentAt" TIMESTAMP(3);
ALTER TABLE "slp_members" ADD COLUMN "emailChangeCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "slp_members" ADD COLUMN "resubmitted" BOOLEAN NOT NULL DEFAULT false;
