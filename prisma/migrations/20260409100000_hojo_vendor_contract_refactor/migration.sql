-- ============================================
-- ベンダー情報大規模改修
-- 1. 契約状況マスタ（共通）追加
-- 2. 契約書テーブル（複数URL+ファイル）追加
-- 3. 各サービスに契約日/終了予定日/契約状況追加
-- 4. キックオフMTGを文字列→DateTime型に変換（既存値クリア）
-- 5. 契約日/案件ステータス/開始日/終了予定日（全体）削除
-- 6. 既存契約書URLを新テーブルに移行
-- ============================================

-- ----------------------------------------------
-- 1. 共通の契約状況マスタテーブル作成
-- ----------------------------------------------
CREATE TABLE "hojo_vendor_contract_statuses" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hojo_vendor_contract_statuses_pkey" PRIMARY KEY ("id")
);

-- ----------------------------------------------
-- 2. ベンダー契約書テーブル作成
-- ----------------------------------------------
CREATE TABLE "hojo_vendor_contract_documents" (
    "id" SERIAL NOT NULL,
    "vendor_id" INTEGER NOT NULL,
    "service_type" VARCHAR(50) NOT NULL,
    "type" VARCHAR(20) NOT NULL,
    "url" VARCHAR(1000),
    "file_path" VARCHAR(500),
    "file_name" VARCHAR(255),
    "file_size" INTEGER,
    "mime_type" VARCHAR(100),
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hojo_vendor_contract_documents_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "hojo_vendor_contract_documents_vendor_id_service_type_idx" ON "hojo_vendor_contract_documents"("vendor_id", "service_type");

ALTER TABLE "hojo_vendor_contract_documents" ADD CONSTRAINT "hojo_vendor_contract_documents_vendor_id_fkey"
    FOREIGN KEY ("vendor_id") REFERENCES "hojo_vendors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ----------------------------------------------
-- 3. hojo_vendors に新カラム追加
-- ----------------------------------------------
ALTER TABLE "hojo_vendors"
    ADD COLUMN "kickoff_mtg" TIMESTAMP(3),
    ADD COLUMN "sc_wholesale_contract_status_id" INTEGER,
    ADD COLUMN "sc_wholesale_contract_date" TIMESTAMP(3),
    ADD COLUMN "sc_wholesale_end_date" TIMESTAMP(3),
    ADD COLUMN "consulting_plan_contract_status_id" INTEGER,
    ADD COLUMN "consulting_plan_contract_date" TIMESTAMP(3),
    ADD COLUMN "consulting_plan_end_date" TIMESTAMP(3),
    ADD COLUMN "grant_application_bpo_contract_status_id" INTEGER,
    ADD COLUMN "grant_application_bpo_contract_date" TIMESTAMP(3);

-- ----------------------------------------------
-- 4. 既存の契約書URLを新テーブルへ移行
-- ----------------------------------------------
INSERT INTO "hojo_vendor_contract_documents" ("vendor_id", "service_type", "type", "url", "display_order")
SELECT "id", 'scWholesale', 'url', "sc_wholesale_contract_url", 0
FROM "hojo_vendors"
WHERE "sc_wholesale_contract_url" IS NOT NULL AND "sc_wholesale_contract_url" <> '';

INSERT INTO "hojo_vendor_contract_documents" ("vendor_id", "service_type", "type", "url", "display_order")
SELECT "id", 'consultingPlan', 'url', "consulting_plan_contract_url", 0
FROM "hojo_vendors"
WHERE "consulting_plan_contract_url" IS NOT NULL AND "consulting_plan_contract_url" <> '';

INSERT INTO "hojo_vendor_contract_documents" ("vendor_id", "service_type", "type", "url", "display_order")
SELECT "id", 'grantApplicationBpo', 'url', "grant_application_bpo_contract_url", 0
FROM "hojo_vendors"
WHERE "grant_application_bpo_contract_url" IS NOT NULL AND "grant_application_bpo_contract_url" <> '';

-- ----------------------------------------------
-- 5. 不要カラムを削除
-- ----------------------------------------------
-- 案件ステータスのFK削除
ALTER TABLE "hojo_vendors" DROP CONSTRAINT IF EXISTS "hojo_vendors_case_status_id_fkey";

ALTER TABLE "hojo_vendors"
    DROP COLUMN IF EXISTS "contract_date",
    DROP COLUMN IF EXISTS "case_status_id",
    DROP COLUMN IF EXISTS "consulting_start_date",
    DROP COLUMN IF EXISTS "consulting_end_date",
    DROP COLUMN IF EXISTS "sc_wholesale_contract_url",
    DROP COLUMN IF EXISTS "consulting_plan_contract_url",
    DROP COLUMN IF EXISTS "grant_application_bpo_contract_url",
    DROP COLUMN IF EXISTS "loan_usage_contract_url";

-- ----------------------------------------------
-- 6. キックオフMTG カラムを TEXT → TIMESTAMP に変換
-- 既存のテキスト値は日付に変換できないためクリア
-- ----------------------------------------------
ALTER TABLE "hojo_vendors"
    ALTER COLUMN "sc_wholesale_kickoff_mtg" TYPE TIMESTAMP(3) USING NULL,
    ALTER COLUMN "consulting_plan_kickoff_mtg" TYPE TIMESTAMP(3) USING NULL,
    ALTER COLUMN "grant_application_bpo_kickoff_mtg" TYPE TIMESTAMP(3) USING NULL,
    ALTER COLUMN "subsidy_consulting_kickoff_mtg" TYPE TIMESTAMP(3) USING NULL,
    ALTER COLUMN "loan_usage_kickoff_mtg" TYPE TIMESTAMP(3) USING NULL;

-- ----------------------------------------------
-- 7. 契約状況マスタへのFK追加
-- ----------------------------------------------
ALTER TABLE "hojo_vendors" ADD CONSTRAINT "hojo_vendors_sc_wholesale_contract_status_id_fkey"
    FOREIGN KEY ("sc_wholesale_contract_status_id") REFERENCES "hojo_vendor_contract_statuses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "hojo_vendors" ADD CONSTRAINT "hojo_vendors_consulting_plan_contract_status_id_fkey"
    FOREIGN KEY ("consulting_plan_contract_status_id") REFERENCES "hojo_vendor_contract_statuses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "hojo_vendors" ADD CONSTRAINT "hojo_vendors_grant_application_bpo_contract_status_id_fkey"
    FOREIGN KEY ("grant_application_bpo_contract_status_id") REFERENCES "hojo_vendor_contract_statuses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ----------------------------------------------
-- 8. 案件ステータスマスタテーブル削除（不要になった）
-- ----------------------------------------------
DROP TABLE IF EXISTS "hojo_vendor_case_statuses";
