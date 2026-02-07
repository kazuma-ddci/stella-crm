-- AlterTable: Add code column (nullable first)
ALTER TABLE "master_projects" ADD COLUMN "code" VARCHAR(50);

-- Populate code from existing name (lowercase)
UPDATE "master_projects" SET "code" = LOWER("name");

-- Make code NOT NULL
ALTER TABLE "master_projects" ALTER COLUMN "code" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "master_projects_code_key" ON "master_projects"("code");
