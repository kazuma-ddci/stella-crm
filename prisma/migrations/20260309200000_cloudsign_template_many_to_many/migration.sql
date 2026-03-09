-- クラウドサインテンプレートマスタ（運営法人ごとに管理）
CREATE TABLE "cloudsign_templates" (
    "id" SERIAL PRIMARY KEY,
    "operating_company_id" INTEGER NOT NULL,
    "cloudsign_template_id" VARCHAR(100) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "description" VARCHAR(500),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cloudsign_templates_operating_company_id_fkey"
        FOREIGN KEY ("operating_company_id") REFERENCES "operating_companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "cloudsign_templates_operating_company_id_cloudsign_template_id_key"
    ON "cloudsign_templates"("operating_company_id", "cloudsign_template_id");

CREATE INDEX "idx_cloudsign_templates_operating_company_id"
    ON "cloudsign_templates"("operating_company_id");

-- クラウドサインテンプレート × 契約種別 中間テーブル
CREATE TABLE "cloudsign_template_contract_types" (
    "id" SERIAL PRIMARY KEY,
    "template_id" INTEGER NOT NULL,
    "contract_type_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cloudsign_template_contract_types_template_id_fkey"
        FOREIGN KEY ("template_id") REFERENCES "cloudsign_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "cloudsign_template_contract_types_contract_type_id_fkey"
        FOREIGN KEY ("contract_type_id") REFERENCES "contract_types"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "cloudsign_template_contract_types_template_id_contract_type_id_key"
    ON "cloudsign_template_contract_types"("template_id", "contract_type_id");

CREATE INDEX "idx_cloudsign_template_contract_types_contract_type_id"
    ON "cloudsign_template_contract_types"("contract_type_id");

-- ContractType の旧 cloudsign_template_id カラムを削除
ALTER TABLE "contract_types" DROP COLUMN IF EXISTS "cloudsign_template_id";
