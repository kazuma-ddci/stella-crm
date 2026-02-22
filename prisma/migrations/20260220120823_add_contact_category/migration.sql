-- AlterTable
ALTER TABLE "contact_histories" ADD COLUMN     "contact_category_id" INTEGER;

-- CreateTable
CREATE TABLE "contact_categories" (
    "id" SERIAL NOT NULL,
    "project_id" INTEGER NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contact_categories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_contact_categories_project_id" ON "contact_categories"("project_id");

-- CreateIndex
CREATE UNIQUE INDEX "contact_categories_project_id_name_key" ON "contact_categories"("project_id", "name");

-- CreateIndex
CREATE INDEX "idx_contact_histories_contact_category_id" ON "contact_histories"("contact_category_id");

-- AddForeignKey
ALTER TABLE "contact_categories" ADD CONSTRAINT "contact_categories_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "master_projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contact_histories" ADD CONSTRAINT "contact_histories_contact_category_id_fkey" FOREIGN KEY ("contact_category_id") REFERENCES "contact_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
