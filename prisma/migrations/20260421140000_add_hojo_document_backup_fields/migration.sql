ALTER TABLE "hojo_application_support_documents"
  ADD COLUMN "previous_edited_sections" JSONB,
  ADD COLUMN "previous_file_path" VARCHAR(500),
  ADD COLUMN "previous_file_name" VARCHAR(255);
