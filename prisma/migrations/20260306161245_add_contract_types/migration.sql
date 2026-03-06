-- CreateTable
CREATE TABLE "contract_types" (
    "id" SERIAL NOT NULL,
    "project_id" INTEGER NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contract_types_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_contract_types_project_id" ON "contract_types"("project_id");

-- CreateIndex
CREATE UNIQUE INDEX "contract_types_project_id_name_key" ON "contract_types"("project_id", "name");

-- AddForeignKey
ALTER TABLE "contract_types" ADD CONSTRAINT "contract_types_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "master_projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Insert default contract types for STP project (id=1)
INSERT INTO "contract_types" ("project_id", "name", "display_order", "updated_at") VALUES
  (1, '業務委託契約', 1, NOW()),
  (1, '秘密保持契約', 2, NOW()),
  (1, '代理店契約', 3, NOW()),
  (1, '利用規約同意書', 4, NOW()),
  (1, 'その他', 5, NOW());

-- Insert new staff field definitions
INSERT INTO "staff_field_definitions" ("field_code", "field_name", "display_order", "updated_at")
VALUES
  ('CONTRACT_ASSIGNED_TO', '契約書 担当者', 9, NOW()),
  ('CONTACT_HISTORY_STAFF', '接触履歴 担当者', 10, NOW())
ON CONFLICT ("field_code") DO NOTHING;
