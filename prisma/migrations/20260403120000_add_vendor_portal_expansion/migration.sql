-- ============================================
-- ベンダーポータル機能拡張マイグレーション
-- Phase 1-5: 全テーブル一括作成
-- ============================================

-- 1. ステータスマスタテーブル（3つ）
CREATE TABLE "hojo_vendor_sc_wholesale_statuses" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "hojo_vendor_sc_wholesale_statuses_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "hojo_vendor_consulting_plan_statuses" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "hojo_vendor_consulting_plan_statuses_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "hojo_vendor_registration_statuses" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "hojo_vendor_registration_statuses_pkey" PRIMARY KEY ("id")
);

-- 2. HojoVendor に新カラム追加
ALTER TABLE "hojo_vendors" ADD COLUMN "representative_name" VARCHAR(200);
ALTER TABLE "hojo_vendors" ADD COLUMN "representative_line_friend_id" INTEGER;
ALTER TABLE "hojo_vendors" ADD COLUMN "contact_person_name" VARCHAR(200);
ALTER TABLE "hojo_vendors" ADD COLUMN "contact_person_line_friend_id" INTEGER;
ALTER TABLE "hojo_vendors" ADD COLUMN "email" VARCHAR(255);
ALTER TABLE "hojo_vendors" ADD COLUMN "phone" VARCHAR(50);
ALTER TABLE "hojo_vendors" ADD COLUMN "sc_wholesale_status_id" INTEGER;
ALTER TABLE "hojo_vendors" ADD COLUMN "sc_wholesale_kickoff_mtg" TEXT;
ALTER TABLE "hojo_vendors" ADD COLUMN "sc_wholesale_contract_url" VARCHAR(500);
ALTER TABLE "hojo_vendors" ADD COLUMN "consulting_plan_status_id" INTEGER;
ALTER TABLE "hojo_vendors" ADD COLUMN "consulting_plan_kickoff_mtg" TEXT;
ALTER TABLE "hojo_vendors" ADD COLUMN "consulting_plan_contract_url" VARCHAR(500);
ALTER TABLE "hojo_vendors" ADD COLUMN "grant_application_bpo" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "hojo_vendors" ADD COLUMN "grant_application_bpo_kickoff_mtg" TEXT;
ALTER TABLE "hojo_vendors" ADD COLUMN "grant_application_bpo_contract_url" VARCHAR(500);
ALTER TABLE "hojo_vendors" ADD COLUMN "subsidy_consulting" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "hojo_vendors" ADD COLUMN "subsidy_consulting_kickoff_mtg" TEXT;
ALTER TABLE "hojo_vendors" ADD COLUMN "loan_usage" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "hojo_vendors" ADD COLUMN "loan_usage_kickoff_mtg" TEXT;
ALTER TABLE "hojo_vendors" ADD COLUMN "loan_usage_contract_url" VARCHAR(500);
ALTER TABLE "hojo_vendors" ADD COLUMN "vendor_registration_status_id" INTEGER;

-- 3. コンサル契約テーブル
CREATE TABLE "hojo_consulting_contracts" (
    "id" SERIAL NOT NULL,
    "vendor_id" INTEGER NOT NULL,
    "line_number" VARCHAR(100),
    "line_name" VARCHAR(200),
    "referral_url" VARCHAR(500),
    "assigned_as" VARCHAR(200),
    "consulting_staff" VARCHAR(200),
    "company_name" VARCHAR(200) NOT NULL,
    "representative_name" VARCHAR(200),
    "main_contact_name" VARCHAR(200),
    "customer_email" VARCHAR(255),
    "customer_phone" VARCHAR(50),
    "contract_date" TIMESTAMP(3),
    "contract_plan" VARCHAR(200),
    "contract_amount" DECIMAL(12,0),
    "service_type" VARCHAR(200),
    "case_status" VARCHAR(100),
    "has_sc_sales" BOOLEAN NOT NULL DEFAULT false,
    "has_subsidy_consulting" BOOLEAN NOT NULL DEFAULT false,
    "has_bpo_support" BOOLEAN NOT NULL DEFAULT false,
    "consulting_plan" VARCHAR(200),
    "success_fee" DECIMAL(12,0),
    "start_date" TIMESTAMP(3),
    "end_date" TIMESTAMP(3),
    "billing_status" VARCHAR(100),
    "payment_status" VARCHAR(100),
    "revenue_recording_date" TIMESTAMP(3),
    "gross_profit" DECIMAL(12,0),
    "notes" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "hojo_consulting_contracts_pkey" PRIMARY KEY ("id")
);

-- 4. コンサル活動記録テーブル
CREATE TABLE "hojo_consulting_activities" (
    "id" SERIAL NOT NULL,
    "vendor_id" INTEGER NOT NULL,
    "contract_id" INTEGER,
    "activity_date" TIMESTAMP(3) NOT NULL,
    "contact_method" VARCHAR(100),
    "vendor_issue" TEXT,
    "hearing_content" TEXT,
    "response_content" TEXT,
    "proposal_content" TEXT,
    "vendor_next_action" TEXT,
    "next_deadline" TIMESTAMP(3),
    "vendor_task" VARCHAR(500),
    "vendor_task_deadline" TIMESTAMP(3),
    "vendor_task_priority" VARCHAR(20),
    "vendor_task_completed" BOOLEAN NOT NULL DEFAULT false,
    "support_task" VARCHAR(500),
    "support_task_deadline" TIMESTAMP(3),
    "support_task_priority" VARCHAR(20),
    "support_task_completed" BOOLEAN NOT NULL DEFAULT false,
    "attachment_url" VARCHAR(500),
    "recording_url" VARCHAR(500),
    "screenshot_url" VARCHAR(500),
    "notes" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "hojo_consulting_activities_pkey" PRIMARY KEY ("id")
);

-- 5. 助成金顧客情報（概要案内フェーズ）
CREATE TABLE "hojo_grant_customer_pre_applications" (
    "id" SERIAL NOT NULL,
    "vendor_id" INTEGER NOT NULL,
    "application_support_id" INTEGER,
    "is_bpo" BOOLEAN NOT NULL DEFAULT false,
    "applicant_name" VARCHAR(200),
    "referrer" VARCHAR(200),
    "sales_staff" VARCHAR(200),
    "category" VARCHAR(100),
    "status" VARCHAR(100),
    "prospect_level" VARCHAR(100),
    "detail_memo" TEXT,
    "next_action" TEXT,
    "next_contact_date" TIMESTAMP(3),
    "overview_briefing_date" TIMESTAMP(3),
    "mtg_recording_url" VARCHAR(500),
    "briefing_staff" VARCHAR(200),
    "phone" VARCHAR(50),
    "business_entity" VARCHAR(100),
    "industry" VARCHAR(200),
    "system_type" VARCHAR(200),
    "has_loan" VARCHAR(20),
    "revenue_range" VARCHAR(100),
    "important_tags" TEXT,
    "loan_pattern" VARCHAR(100),
    "referrer_reward_pct" DECIMAL(5,3),
    "agent1_number" VARCHAR(100),
    "agent1_reward_pct" DECIMAL(5,3),
    "total_reward" DECIMAL(12,0),
    "double_checker" VARCHAR(200),
    "repeat_judgment" VARCHAR(100),
    "wage_raise_eligible" VARCHAR(100),
    "past_product" VARCHAR(200),
    "lost_date" TIMESTAMP(3),
    "agent_contract_url" VARCHAR(500),
    "doc_collection_start" TIMESTAMP(3),
    "doc_submission_date" TIMESTAMP(3),
    "business_name" VARCHAR(200),
    "doc_1" VARCHAR(500),
    "doc_2" VARCHAR(500),
    "doc_3" VARCHAR(500),
    "doc_4" VARCHAR(500),
    "doc_5" VARCHAR(500),
    "it_strategy_navi_pdf" VARCHAR(500),
    "has_employees" VARCHAR(50),
    "gbizid_screenshot" VARCHAR(500),
    "gbizid_address" VARCHAR(255),
    "self_declaration_id" VARCHAR(20),
    "anti_social_check" VARCHAR(100),
    "establishment_date" TIMESTAMP(3),
    "capital" VARCHAR(100),
    "fiscal_month" VARCHAR(20),
    "revenue" DECIMAL(14,0),
    "gross_profit" DECIMAL(14,0),
    "operating_profit" DECIMAL(14,0),
    "ordinary_profit" DECIMAL(14,0),
    "depreciation" DECIMAL(14,0),
    "labor_cost" DECIMAL(14,0),
    "capital_or_reserve" VARCHAR(200),
    "executive_compensation" DECIMAL(14,0),
    "total_salary_prev_year" DECIMAL(14,0),
    "plan_year1" VARCHAR(200),
    "plan_year2" VARCHAR(200),
    "plan_year3" VARCHAR(200),
    "bonus1_target" VARCHAR(200),
    "bonus1_doc" VARCHAR(500),
    "bonus2_target" VARCHAR(200),
    "bonus2_doc" VARCHAR(500),
    "min_wage" VARCHAR(100),
    "application_system" VARCHAR(200),
    "business_description_draft" TEXT,
    "business_process_note" TEXT,
    "homepage_url" VARCHAR(500),
    "business_description" TEXT,
    "challenge_title" VARCHAR(500),
    "challenge_goal" TEXT,
    "growth_matching_description" TEXT,
    "data_entry_staff" VARCHAR(200),
    "data_entry_confirmed" VARCHAR(100),
    "business_description_final" TEXT,
    "industry_code" VARCHAR(20),
    "office_count" INTEGER,
    "emp_regular" INTEGER,
    "emp_contract" INTEGER,
    "emp_part_time" INTEGER,
    "emp_dispatch" INTEGER,
    "emp_other" INTEGER,
    "wage_table_1" VARCHAR(200),
    "wage_table_2" VARCHAR(200),
    "wage_table_3" VARCHAR(200),
    "wage_table_4" VARCHAR(200),
    "wage_table_5" VARCHAR(200),
    "wage_table_6" VARCHAR(200),
    "wage_table_7" VARCHAR(200),
    "wage_table_8" VARCHAR(200),
    "wage_table_9" VARCHAR(200),
    "wage_table_10" VARCHAR(200),
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "hojo_grant_customer_pre_applications_pkey" PRIMARY KEY ("id")
);

-- 6. 助成金顧客情報（交付申請フェーズ）+ 貸付管理
CREATE TABLE "hojo_grant_customer_post_applications" (
    "id" SERIAL NOT NULL,
    "vendor_id" INTEGER NOT NULL,
    "pre_application_id" INTEGER,
    "is_bpo" BOOLEAN NOT NULL DEFAULT false,
    "applicant_name" VARCHAR(200),
    "memo" TEXT,
    "referrer" VARCHAR(200),
    "sales_staff" VARCHAR(200),
    "application_completed_date" TIMESTAMP(3),
    "application_staff" VARCHAR(200),
    "grant_application_number" VARCHAR(100),
    "next_action" TEXT,
    "next_contact_date" TIMESTAMP(3),
    "document_storage_url" VARCHAR(500),
    "existing_documents" TEXT,
    "staff_email" VARCHAR(255),
    "growth_matching_url" VARCHAR(500),
    "growth_matching_status" VARCHAR(100),
    "wage_raise" VARCHAR(100),
    "labor_saving_navi" VARCHAR(100),
    "invoice_registration" VARCHAR(100),
    "repeat_judgment" VARCHAR(100),
    "subsidy_applicant_name" VARCHAR(200),
    "prefecture" VARCHAR(50),
    "recruitment_round" VARCHAR(50),
    "application_type" VARCHAR(100),
    "subsidy_status" VARCHAR(100),
    "subsidy_status_updated" TIMESTAMP(3),
    "subsidy_vendor_name" VARCHAR(200),
    "it_tool_name" VARCHAR(200),
    "subsidy_target_amount" INTEGER,
    "subsidy_applied_amount" INTEGER,
    "grant_decision_date" TIMESTAMP(3),
    "grant_decision_amount" INTEGER,
    "confirmation_approval_date" TIMESTAMP(3),
    "subsidy_confirmed_amount" INTEGER,
    "delivery_date" TIMESTAMP(3),
    "delivery_completed" VARCHAR(20),
    "employee_list_url" VARCHAR(500),
    "employee_list_form_url" VARCHAR(500),
    "employee_list_created" VARCHAR(100),
    "performance_report_date" TIMESTAMP(3),
    "performance_report_completed" VARCHAR(20),
    "confirmation_date" TIMESTAMP(3),
    "confirmation_completed" VARCHAR(20),
    "grant_date" TIMESTAMP(3),
    "grant_completed" VARCHAR(20),
    "refund_date" TIMESTAMP(3),
    "refund_completed" VARCHAR(20),
    "subsidy_payment_date" TIMESTAMP(3),
    "subsidy_payment_completed" VARCHAR(20),
    "completed_date" TIMESTAMP(3),
    "loan_survey_response" VARCHAR(200),
    "has_loan" BOOLEAN NOT NULL DEFAULT false,
    "loan_mtg_date" TIMESTAMP(3),
    "loan_mtg_completed" VARCHAR(20),
    "loan_mtg_staff" VARCHAR(200),
    "loan_location" VARCHAR(200),
    "loan_amount" DECIMAL(12,0),
    "loan_cash" VARCHAR(100),
    "loan_double_checker" VARCHAR(200),
    "loan_payment_date" TIMESTAMP(3),
    "loan_time" VARCHAR(50),
    "loan_payment_completed" VARCHAR(20),
    "referrer_number" VARCHAR(100),
    "referrer_line_name" VARCHAR(200),
    "referrer_pct" DECIMAL(5,3),
    "referrer_amount" DECIMAL(12,0),
    "referrer_payment_date" TIMESTAMP(3),
    "referrer_payment_completed" VARCHAR(20),
    "agent1_number" VARCHAR(100),
    "agent1_line_name" VARCHAR(200),
    "agent1_pct" DECIMAL(5,3),
    "agent1_amount" DECIMAL(12,0),
    "agent1_payment_date" TIMESTAMP(3),
    "agent1_payment_completed" VARCHAR(20),
    "agent2_number" VARCHAR(100),
    "agent2_line_name" VARCHAR(200),
    "agent2_pct" DECIMAL(5,3),
    "agent2_amount" DECIMAL(12,0),
    "agent2_payment_date" TIMESTAMP(3),
    "agent2_payment_completed" VARCHAR(20),
    "agent3_number" VARCHAR(100),
    "agent3_line_name" VARCHAR(200),
    "agent3_pct" DECIMAL(5,3),
    "agent3_amount" DECIMAL(12,0),
    "agent3_payment_date" TIMESTAMP(3),
    "agent3_payment_completed" VARCHAR(20),
    "vendor_pattern" VARCHAR(200),
    "tool_pattern" VARCHAR(200),
    "wage_table_1" VARCHAR(200),
    "wage_table_2" VARCHAR(200),
    "wage_table_3" VARCHAR(200),
    "wage_table_4" VARCHAR(200),
    "wage_table_5" VARCHAR(200),
    "wage_table_6" VARCHAR(200),
    "wage_table_7" VARCHAR(200),
    "wage_table_8" VARCHAR(200),
    "wage_table_9" VARCHAR(200),
    "wage_table_10" VARCHAR(200),
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "hojo_grant_customer_post_applications_pkey" PRIMARY KEY ("id")
);

-- 7. インデックス
CREATE INDEX "hojo_consulting_contracts_vendor_id_idx" ON "hojo_consulting_contracts"("vendor_id");
CREATE INDEX "hojo_consulting_activities_vendor_id_idx" ON "hojo_consulting_activities"("vendor_id");
CREATE INDEX "hojo_consulting_activities_contract_id_idx" ON "hojo_consulting_activities"("contract_id");
CREATE INDEX "hojo_grant_customer_pre_applications_vendor_id_idx" ON "hojo_grant_customer_pre_applications"("vendor_id");
CREATE INDEX "hojo_grant_customer_pre_applications_application_support_id_idx" ON "hojo_grant_customer_pre_applications"("application_support_id");
CREATE INDEX "hojo_grant_customer_post_applications_vendor_id_idx" ON "hojo_grant_customer_post_applications"("vendor_id");
CREATE INDEX "hojo_grant_customer_post_applications_pre_application_id_idx" ON "hojo_grant_customer_post_applications"("pre_application_id");

-- 8. 外部キー制約
ALTER TABLE "hojo_vendors" ADD CONSTRAINT "hojo_vendors_representative_line_friend_id_fkey" FOREIGN KEY ("representative_line_friend_id") REFERENCES "hojo_line_friends_security_cloud"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "hojo_vendors" ADD CONSTRAINT "hojo_vendors_contact_person_line_friend_id_fkey" FOREIGN KEY ("contact_person_line_friend_id") REFERENCES "hojo_line_friends_security_cloud"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "hojo_vendors" ADD CONSTRAINT "hojo_vendors_sc_wholesale_status_id_fkey" FOREIGN KEY ("sc_wholesale_status_id") REFERENCES "hojo_vendor_sc_wholesale_statuses"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "hojo_vendors" ADD CONSTRAINT "hojo_vendors_consulting_plan_status_id_fkey" FOREIGN KEY ("consulting_plan_status_id") REFERENCES "hojo_vendor_consulting_plan_statuses"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "hojo_vendors" ADD CONSTRAINT "hojo_vendors_vendor_registration_status_id_fkey" FOREIGN KEY ("vendor_registration_status_id") REFERENCES "hojo_vendor_registration_statuses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "hojo_consulting_contracts" ADD CONSTRAINT "hojo_consulting_contracts_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "hojo_vendors"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "hojo_consulting_activities" ADD CONSTRAINT "hojo_consulting_activities_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "hojo_vendors"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "hojo_consulting_activities" ADD CONSTRAINT "hojo_consulting_activities_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "hojo_consulting_contracts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "hojo_grant_customer_pre_applications" ADD CONSTRAINT "hojo_grant_customer_pre_applications_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "hojo_vendors"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "hojo_grant_customer_pre_applications" ADD CONSTRAINT "hojo_grant_customer_pre_applications_application_support_id_fkey" FOREIGN KEY ("application_support_id") REFERENCES "hojo_application_supports"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "hojo_grant_customer_post_applications" ADD CONSTRAINT "hojo_grant_customer_post_applications_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "hojo_vendors"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "hojo_grant_customer_post_applications" ADD CONSTRAINT "hojo_grant_customer_post_applications_pre_application_id_fkey" FOREIGN KEY ("pre_application_id") REFERENCES "hojo_grant_customer_pre_applications"("id") ON DELETE SET NULL ON UPDATE CASCADE;
