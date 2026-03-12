-- AlterTable: MasterContract - CloudSign自社署名URL関連フィールド追加
ALTER TABLE "master_contracts" ADD COLUMN "cloudsign_self_signing_url" VARCHAR(2000);
ALTER TABLE "master_contracts" ADD COLUMN "cloudsign_self_signing_email_id" INTEGER;

-- AlterTable: OperatingCompanyEmail - CloudSign署名メール用UID追跡
ALTER TABLE "OperatingCompanyEmail" ADD COLUMN "lastCheckedCloudsignUid" INTEGER NOT NULL DEFAULT 0;

-- AddForeignKey
ALTER TABLE "master_contracts" ADD CONSTRAINT "master_contracts_cloudsign_self_signing_email_id_fkey" FOREIGN KEY ("cloudsign_self_signing_email_id") REFERENCES "OperatingCompanyEmail"("id") ON DELETE SET NULL ON UPDATE CASCADE;
