-- ============================================
-- SLP 企業名簿 Phase 1: 基本情報・金額・契約情報の追加
-- 4つの新マスタ（業種・流入経路・ステータス①・ステータス②）と
-- SlpCompanyRecord に企業情報・金額情報のカラムを追加
-- ============================================

-- 業種マスタ
CREATE TABLE "slp_industry_masters" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "slp_industry_masters_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "slp_industry_masters_name_key" ON "slp_industry_masters"("name");

-- 流入経路マスタ
CREATE TABLE "slp_flow_source_masters" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "slp_flow_source_masters_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "slp_flow_source_masters_name_key" ON "slp_flow_source_masters"("name");

-- 企業ステータス①マスタ
CREATE TABLE "slp_company_status1_masters" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "slp_company_status1_masters_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "slp_company_status1_masters_name_key" ON "slp_company_status1_masters"("name");

-- 企業ステータス②マスタ
CREATE TABLE "slp_company_status2_masters" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "slp_company_status2_masters_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "slp_company_status2_masters_name_key" ON "slp_company_status2_masters"("name");

-- ============================================
-- SlpCompanyRecord に基本情報カラムを追加
-- ============================================

-- 企業基本情報
ALTER TABLE "slp_company_records" ADD COLUMN "company_name" VARCHAR(200);
ALTER TABLE "slp_company_records" ADD COLUMN "representative_name" VARCHAR(100);
ALTER TABLE "slp_company_records" ADD COLUMN "employee_count" INTEGER;
ALTER TABLE "slp_company_records" ADD COLUMN "prefecture" VARCHAR(20);
ALTER TABLE "slp_company_records" ADD COLUMN "address" VARCHAR(500);
ALTER TABLE "slp_company_records" ADD COLUMN "company_phone" VARCHAR(50);
ALTER TABLE "slp_company_records" ADD COLUMN "pension_office" VARCHAR(100);
ALTER TABLE "slp_company_records" ADD COLUMN "pension_officer_name" VARCHAR(100);
ALTER TABLE "slp_company_records" ADD COLUMN "industry_id" INTEGER;
ALTER TABLE "slp_company_records" ADD COLUMN "flow_source_id" INTEGER;
ALTER TABLE "slp_company_records" ADD COLUMN "referrer_text" VARCHAR(200);
ALTER TABLE "slp_company_records" ADD COLUMN "sales_staff_id" INTEGER;
ALTER TABLE "slp_company_records" ADD COLUMN "as_staff_id" INTEGER;
ALTER TABLE "slp_company_records" ADD COLUMN "documents_folder_url" VARCHAR(1000);
ALTER TABLE "slp_company_records" ADD COLUMN "status1_id" INTEGER;
ALTER TABLE "slp_company_records" ADD COLUMN "status2_id" INTEGER;
ALTER TABLE "slp_company_records" ADD COLUMN "last_contact_date" DATE;

-- 金額・契約情報
ALTER TABLE "slp_company_records" ADD COLUMN "initial_fee" DECIMAL(15,2);
ALTER TABLE "slp_company_records" ADD COLUMN "initial_people_count" INTEGER;
ALTER TABLE "slp_company_records" ADD COLUMN "monthly_fee" DECIMAL(15,2);
ALTER TABLE "slp_company_records" ADD COLUMN "monthly_people_count" INTEGER;
ALTER TABLE "slp_company_records" ADD COLUMN "contract_date" DATE;
ALTER TABLE "slp_company_records" ADD COLUMN "last_payment_date" DATE;
ALTER TABLE "slp_company_records" ADD COLUMN "invoice_sent_date" DATE;
ALTER TABLE "slp_company_records" ADD COLUMN "next_payment_date" DATE;
ALTER TABLE "slp_company_records" ADD COLUMN "est_max_refund_people" INTEGER;
ALTER TABLE "slp_company_records" ADD COLUMN "est_max_refund_amount" DECIMAL(15,2);
ALTER TABLE "slp_company_records" ADD COLUMN "est_our_revenue" DECIMAL(15,2);
ALTER TABLE "slp_company_records" ADD COLUMN "est_agent_payment" DECIMAL(15,2);
ALTER TABLE "slp_company_records" ADD COLUMN "confirmed_refund_people" INTEGER;
ALTER TABLE "slp_company_records" ADD COLUMN "confirmed_refund_amount" DECIMAL(15,2);
ALTER TABLE "slp_company_records" ADD COLUMN "confirmed_our_revenue" DECIMAL(15,2);
ALTER TABLE "slp_company_records" ADD COLUMN "confirmed_agent_payment" DECIMAL(15,2);
ALTER TABLE "slp_company_records" ADD COLUMN "payment_received_date" DATE;

-- 外部キー制約
ALTER TABLE "slp_company_records" ADD CONSTRAINT "slp_company_records_industry_id_fkey"
    FOREIGN KEY ("industry_id") REFERENCES "slp_industry_masters"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "slp_company_records" ADD CONSTRAINT "slp_company_records_flow_source_id_fkey"
    FOREIGN KEY ("flow_source_id") REFERENCES "slp_flow_source_masters"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "slp_company_records" ADD CONSTRAINT "slp_company_records_status1_id_fkey"
    FOREIGN KEY ("status1_id") REFERENCES "slp_company_status1_masters"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "slp_company_records" ADD CONSTRAINT "slp_company_records_status2_id_fkey"
    FOREIGN KEY ("status2_id") REFERENCES "slp_company_status2_masters"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "slp_company_records" ADD CONSTRAINT "slp_company_records_sales_staff_id_fkey"
    FOREIGN KEY ("sales_staff_id") REFERENCES "master_staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "slp_company_records" ADD CONSTRAINT "slp_company_records_as_staff_id_fkey"
    FOREIGN KEY ("as_staff_id") REFERENCES "master_staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- インデックス
CREATE INDEX "slp_company_records_industry_id_idx" ON "slp_company_records"("industry_id");
CREATE INDEX "slp_company_records_flow_source_id_idx" ON "slp_company_records"("flow_source_id");
CREATE INDEX "slp_company_records_sales_staff_id_idx" ON "slp_company_records"("sales_staff_id");
CREATE INDEX "slp_company_records_as_staff_id_idx" ON "slp_company_records"("as_staff_id");
CREATE INDEX "slp_company_records_status1_id_idx" ON "slp_company_records"("status1_id");
CREATE INDEX "slp_company_records_status2_id_idx" ON "slp_company_records"("status2_id");
