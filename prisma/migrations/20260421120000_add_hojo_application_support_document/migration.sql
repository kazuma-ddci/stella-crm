CREATE TABLE "hojo_application_support_documents" (
  "id" SERIAL NOT NULL,
  "application_support_id" INTEGER NOT NULL,
  "doc_type" VARCHAR(50) NOT NULL,
  "file_path" VARCHAR(500) NOT NULL,
  "file_name" VARCHAR(255) NOT NULL,
  "generated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "hojo_application_support_documents_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "hojo_application_support_documents_application_support_id_doc_type_key"
  ON "hojo_application_support_documents"("application_support_id", "doc_type");

CREATE INDEX "hojo_application_support_documents_application_support_id_idx"
  ON "hojo_application_support_documents"("application_support_id");

ALTER TABLE "hojo_application_support_documents"
  ADD CONSTRAINT "hojo_application_support_documents_application_support_id_fkey"
  FOREIGN KEY ("application_support_id")
  REFERENCES "hojo_application_supports"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
