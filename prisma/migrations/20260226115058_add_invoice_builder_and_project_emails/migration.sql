-- AlterTable
ALTER TABLE "InvoiceGroup" ADD COLUMN     "honorific" TEXT NOT NULL DEFAULT '御中',
ADD COLUMN     "lineOrder" JSONB,
ADD COLUMN     "remarks" TEXT;

-- CreateTable
CREATE TABLE "invoice_group_memo_lines" (
    "id" SERIAL NOT NULL,
    "invoice_group_id" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invoice_group_memo_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_emails" (
    "id" SERIAL NOT NULL,
    "project_id" INTEGER NOT NULL,
    "email_id" INTEGER NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_emails_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "project_emails_project_id_email_id_key" ON "project_emails"("project_id", "email_id");

-- AddForeignKey
ALTER TABLE "invoice_group_memo_lines" ADD CONSTRAINT "invoice_group_memo_lines_invoice_group_id_fkey" FOREIGN KEY ("invoice_group_id") REFERENCES "InvoiceGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_emails" ADD CONSTRAINT "project_emails_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "master_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_emails" ADD CONSTRAINT "project_emails_email_id_fkey" FOREIGN KEY ("email_id") REFERENCES "OperatingCompanyEmail"("id") ON DELETE CASCADE ON UPDATE CASCADE;
