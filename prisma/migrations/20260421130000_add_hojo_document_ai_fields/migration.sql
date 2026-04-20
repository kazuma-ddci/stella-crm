ALTER TABLE "hojo_application_support_documents"
  ADD COLUMN "generated_sections" JSONB,
  ADD COLUMN "edited_sections" JSONB,
  ADD COLUMN "model_name" VARCHAR(50),
  ADD COLUMN "input_tokens" INTEGER,
  ADD COLUMN "output_tokens" INTEGER,
  ADD COLUMN "cache_read_tokens" INTEGER,
  ADD COLUMN "cache_creation_tokens" INTEGER,
  ADD COLUMN "cost_usd" DECIMAL(10, 6);
