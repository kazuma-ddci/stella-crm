-- MasterStellaCompanyに従業員数追加
ALTER TABLE "master_stella_companies" ADD COLUMN "employeeCount" INTEGER;

-- SlpCompanyテーブル作成
CREATE TABLE "slp_companies" (
    "id" SERIAL NOT NULL,
    "companyId" INTEGER NOT NULL,
    "annualLaborCost" INTEGER,
    "targetEmployeeCount" INTEGER,
    "targetEstimateRate" DECIMAL(5,2),
    "consultantStaffId" INTEGER,
    "csStaffId" INTEGER,
    "agentCompanyId" INTEGER,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "slp_companies_pkey" PRIMARY KEY ("id")
);

-- 外部キー制約
ALTER TABLE "slp_companies" ADD CONSTRAINT "slp_companies_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "master_stella_companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "slp_companies" ADD CONSTRAINT "slp_companies_consultantStaffId_fkey"
  FOREIGN KEY ("consultantStaffId") REFERENCES "master_staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "slp_companies" ADD CONSTRAINT "slp_companies_csStaffId_fkey"
  FOREIGN KEY ("csStaffId") REFERENCES "master_staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "slp_companies" ADD CONSTRAINT "slp_companies_agentCompanyId_fkey"
  FOREIGN KEY ("agentCompanyId") REFERENCES "master_stella_companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- スタッフフィールド定義追加
INSERT INTO "staff_field_definitions" ("field_code", "field_name", "description", "created_at", "updated_at")
VALUES
  ('SLP_COMPANY_CONSULTANT', 'SLP案件 担当コンサル', 'SLP案件管理の担当コンサル', NOW(), NOW()),
  ('SLP_COMPANY_CS', 'SLP案件 担当CS', 'SLP案件管理の担当CS', NOW(), NOW());
