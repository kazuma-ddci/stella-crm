-- ============================================
-- 1. StaffFieldDefinition テーブル新設
-- ============================================
CREATE TABLE "staff_field_definitions" (
    "id" SERIAL NOT NULL,
    "field_code" VARCHAR(50) NOT NULL,
    "field_name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "staff_field_definitions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "staff_field_definitions_field_code_key" ON "staff_field_definitions"("field_code");

-- ============================================
-- 2. StaffFieldDefinitionProject テーブル新設
-- ============================================
CREATE TABLE "staff_field_definition_projects" (
    "id" SERIAL NOT NULL,
    "field_definition_id" INTEGER NOT NULL,
    "project_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "staff_field_definition_projects_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "staff_field_definition_projects_field_definition_id_project_key"
    ON "staff_field_definition_projects"("field_definition_id", "project_id");

ALTER TABLE "staff_field_definition_projects"
    ADD CONSTRAINT "staff_field_definition_projects_field_definition_id_fkey"
    FOREIGN KEY ("field_definition_id") REFERENCES "staff_field_definitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "staff_field_definition_projects"
    ADD CONSTRAINT "staff_field_definition_projects_project_id_fkey"
    FOREIGN KEY ("project_id") REFERENCES "master_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================
-- 3. 既存フィールドコードを StaffFieldDefinition にシード
-- ============================================
INSERT INTO "staff_field_definitions" ("field_code", "field_name", "display_order", "updated_at") VALUES
    ('STP_COMPANY_SALES',        'STP企業 担当営業',     1, CURRENT_TIMESTAMP),
    ('STP_COMPANY_ADMIN',        'STP企業 担当事務',     2, CURRENT_TIMESTAMP),
    ('MASTER_COMPANY_STAFF',     '全顧客マスタ 担当者',  3, CURRENT_TIMESTAMP),
    ('CONTRACT_HISTORY_SALES',   '契約履歴 担当営業',    4, CURRENT_TIMESTAMP),
    ('CONTRACT_HISTORY_OPERATION','契約履歴 担当運用',    5, CURRENT_TIMESTAMP),
    ('STP_AGENT_STAFF',          '代理店 担当営業',      6, CURRENT_TIMESTAMP),
    ('STP_AGENT_ADMIN',          '代理店 担当事務',      7, CURRENT_TIMESTAMP),
    ('PROPOSAL_STAFF',           '提案書 担当者',        8, CURRENT_TIMESTAMP);

-- ============================================
-- 4. StaffFieldRestriction リファクタ
--    旧: fieldCode + projectId? + roleTypeId?
--    新: fieldDefinitionId + managingProjectId + sourceProjectId? + roleTypeId?
-- ============================================

-- 4a. 旧ユニーク制約を削除
ALTER TABLE "staff_field_restrictions" DROP CONSTRAINT IF EXISTS "staff_field_restrictions_field_code_project_id_role_type_id_key";

-- 4b. 新カラム追加（NULLable で一旦追加）
ALTER TABLE "staff_field_restrictions" ADD COLUMN "field_definition_id" INTEGER;
ALTER TABLE "staff_field_restrictions" ADD COLUMN "managing_project_id" INTEGER;
ALTER TABLE "staff_field_restrictions" ADD COLUMN "source_project_id" INTEGER;

-- 4c. 既存データの移行
-- fieldCode → fieldDefinitionId を解決
UPDATE "staff_field_restrictions" r
SET "field_definition_id" = d."id"
FROM "staff_field_definitions" d
WHERE r."field_code" = d."field_code";

-- 旧 projectId → sourceProjectId に移行（「選択肢に含めるPJ」の意味）
UPDATE "staff_field_restrictions"
SET "source_project_id" = "project_id"
WHERE "project_id" IS NOT NULL;

-- managingProjectId: 旧データは一律STPプロジェクト（id=1）を設定
-- （既存のフィールド制約は全てSTP関連のため）
-- まずSTPプロジェクトのIDを取得して設定
UPDATE "staff_field_restrictions"
SET "managing_project_id" = (SELECT "id" FROM "master_projects" WHERE "code" = 'stp' LIMIT 1);

-- 4d. field_definition_id, managing_project_id を NOT NULL に変更
ALTER TABLE "staff_field_restrictions" ALTER COLUMN "field_definition_id" SET NOT NULL;
ALTER TABLE "staff_field_restrictions" ALTER COLUMN "managing_project_id" SET NOT NULL;

-- 4e. 旧カラム削除
ALTER TABLE "staff_field_restrictions" DROP COLUMN "field_code";
ALTER TABLE "staff_field_restrictions" DROP COLUMN "project_id";

-- 4f. 新しい制約・インデックス追加
CREATE UNIQUE INDEX "staff_field_restrictions_field_definition_id_managing_proje_key"
    ON "staff_field_restrictions"("field_definition_id", "managing_project_id", "source_project_id", "role_type_id");

CREATE INDEX "idx_field_restrictions_field_managing"
    ON "staff_field_restrictions"("field_definition_id", "managing_project_id");

-- 4g. 外部キー追加
ALTER TABLE "staff_field_restrictions"
    ADD CONSTRAINT "staff_field_restrictions_field_definition_id_fkey"
    FOREIGN KEY ("field_definition_id") REFERENCES "staff_field_definitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "staff_field_restrictions"
    ADD CONSTRAINT "staff_field_restrictions_managing_project_id_fkey"
    FOREIGN KEY ("managing_project_id") REFERENCES "master_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "staff_field_restrictions"
    ADD CONSTRAINT "staff_field_restrictions_source_project_id_fkey"
    FOREIGN KEY ("source_project_id") REFERENCES "master_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================
-- 5. InvoiceTemplate に projectId 追加
-- ============================================
ALTER TABLE "InvoiceTemplate" ADD COLUMN "project_id" INTEGER;

ALTER TABLE "InvoiceTemplate"
    ADD CONSTRAINT "InvoiceTemplate_project_id_fkey"
    FOREIGN KEY ("project_id") REFERENCES "master_projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;
