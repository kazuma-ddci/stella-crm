-- ============================================
-- ベンダーの各サービスに備考フィールド追加
-- ============================================

ALTER TABLE "hojo_vendors"
    ADD COLUMN "sc_wholesale_memo"          TEXT,
    ADD COLUMN "consulting_plan_memo"       TEXT,
    ADD COLUMN "grant_application_bpo_memo" TEXT,
    ADD COLUMN "subsidy_consulting_memo"    TEXT,
    ADD COLUMN "loan_usage_memo"            TEXT,
    ADD COLUMN "vendor_registration_memo"   TEXT,
    ADD COLUMN "tool_registration_memo"     TEXT;
