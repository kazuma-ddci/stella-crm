-- Prismaスキーマ同期用マイグレーション
-- テーブル/カラムは既存マイグレーションで作成済みのため、IF NOT EXISTS で安全に実行

-- OperatingCompany: cloudsign_registered_email（既に追加済みの場合スキップ）
-- ALTER TABLE "operating_companies" ADD COLUMN IF NOT EXISTS "cloudsign_registered_email" VARCHAR(255);

-- ContractType: cloudsign_template_id（既に追加済みの場合スキップ）
-- ALTER TABLE "contract_types" ADD COLUMN IF NOT EXISTS "cloudsign_template_id" VARCHAR(100);

-- MasterContractStatus: cloudsign_status_mapping（既に追加済みの場合スキップ）
-- ALTER TABLE "master_contract_statuses" ADD COLUMN IF NOT EXISTS "cloudsign_status_mapping" VARCHAR(30);

-- MasterContract: cloudsign_title, cloudsign_auto_sync（既に追加済みの場合スキップ）
-- ALTER TABLE "master_contracts" ADD COLUMN IF NOT EXISTS "cloudsign_title" VARCHAR(200);
-- ALTER TABLE "master_contracts" ADD COLUMN IF NOT EXISTS "cloudsign_auto_sync" BOOLEAN NOT NULL DEFAULT true;

-- contract_files テーブル（既に 20260309000000 で作成済み）
-- contract_relations テーブル（既に 20260309000000 で作成済み）

-- このマイグレーションはPrismaスキーマとDBの同期を取るためのものです。
-- 実際のDDLは前のマイグレーション（20260309000000_cloudsign_integration_schema）で実行済み。
SELECT 1;
