-- CreateTable
CREATE TABLE "project_bank_accounts" (
    "id" SERIAL NOT NULL,
    "project_id" INTEGER NOT NULL,
    "bank_account_id" INTEGER NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "memo" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_bank_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "project_bank_accounts_project_id_bank_account_id_key" ON "project_bank_accounts"("project_id", "bank_account_id");

-- AddForeignKey
ALTER TABLE "project_bank_accounts" ADD CONSTRAINT "project_bank_accounts_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "master_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_bank_accounts" ADD CONSTRAINT "project_bank_accounts_bank_account_id_fkey" FOREIGN KEY ("bank_account_id") REFERENCES "operating_company_bank_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
