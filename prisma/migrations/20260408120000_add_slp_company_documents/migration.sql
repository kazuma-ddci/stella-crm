-- CreateTable
CREATE TABLE "slp_company_documents" (
    "id" SERIAL NOT NULL,
    "company_record_id" INTEGER NOT NULL,
    "category" VARCHAR(20) NOT NULL,
    "document_type" VARCHAR(50) NOT NULL,
    "fiscal_period" INTEGER,
    "file_name" VARCHAR(500) NOT NULL,
    "file_path" VARCHAR(1000) NOT NULL,
    "file_size" INTEGER,
    "mime_type" VARCHAR(100),
    "uploaded_by_uid" VARCHAR(100),
    "uploaded_by_name" VARCHAR(200),
    "is_current" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "slp_company_documents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "slp_company_documents_company_record_id_idx" ON "slp_company_documents"("company_record_id");

-- CreateIndex
CREATE INDEX "slp_company_documents_company_record_id_category_document_t_idx" ON "slp_company_documents"("company_record_id", "category", "document_type", "fiscal_period");

-- CreateIndex
CREATE INDEX "slp_company_documents_company_record_id_is_current_deleted__idx" ON "slp_company_documents"("company_record_id", "is_current", "deleted_at");

-- CreateIndex
CREATE INDEX "slp_company_documents_deleted_at_idx" ON "slp_company_documents"("deleted_at");

-- AddForeignKey
ALTER TABLE "slp_company_documents" ADD CONSTRAINT "slp_company_documents_company_record_id_fkey" FOREIGN KEY ("company_record_id") REFERENCES "slp_company_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;
