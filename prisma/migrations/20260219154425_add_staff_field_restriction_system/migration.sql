-- CreateTable
CREATE TABLE "staff_role_type_projects" (
    "id" SERIAL NOT NULL,
    "role_type_id" INTEGER NOT NULL,
    "project_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "staff_role_type_projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff_field_restrictions" (
    "id" SERIAL NOT NULL,
    "field_code" VARCHAR(50) NOT NULL,
    "project_id" INTEGER,
    "role_type_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "staff_field_restrictions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "staff_role_type_projects_role_type_id_project_id_key" ON "staff_role_type_projects"("role_type_id", "project_id");

-- CreateIndex
CREATE UNIQUE INDEX "staff_field_restrictions_field_code_project_id_role_type_id_key" ON "staff_field_restrictions"("field_code", "project_id", "role_type_id");

-- AddForeignKey
ALTER TABLE "staff_role_type_projects" ADD CONSTRAINT "staff_role_type_projects_role_type_id_fkey" FOREIGN KEY ("role_type_id") REFERENCES "staff_role_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_role_type_projects" ADD CONSTRAINT "staff_role_type_projects_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "master_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_field_restrictions" ADD CONSTRAINT "staff_field_restrictions_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "master_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_field_restrictions" ADD CONSTRAINT "staff_field_restrictions_role_type_id_fkey" FOREIGN KEY ("role_type_id") REFERENCES "staff_role_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;
