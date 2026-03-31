-- 卸アカウント管理テーブル作成
CREATE TABLE "hojo_wholesale_accounts" (
    "id" SERIAL NOT NULL,
    "vendor_id" INTEGER NOT NULL,
    "support_provider_name" VARCHAR(200),
    "company_name" VARCHAR(200),
    "email" VARCHAR(255),
    "recruitment_round" INTEGER,
    "adoption_date" TIMESTAMP(3),
    "issue_request_date" TIMESTAMP(3),
    "account_approval_date" TIMESTAMP(3),
    "grant_date" TIMESTAMP(3),
    "tool_cost" INTEGER,
    "invoice_status" VARCHAR(50),
    "deleted_by_vendor" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "hojo_wholesale_accounts_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "hojo_wholesale_accounts" ADD CONSTRAINT "hojo_wholesale_accounts_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "hojo_vendors"("id") ON DELETE CASCADE ON UPDATE CASCADE;
