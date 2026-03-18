-- MasterProject に SLP入会フォーム用契約種別のFK追加
ALTER TABLE "master_projects" ADD COLUMN "slp_member_contract_type_id" INTEGER;

-- 外部キー制約
ALTER TABLE "master_projects"
  ADD CONSTRAINT "master_projects_slp_member_contract_type_id_fkey"
  FOREIGN KEY ("slp_member_contract_type_id")
  REFERENCES "contract_types"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
