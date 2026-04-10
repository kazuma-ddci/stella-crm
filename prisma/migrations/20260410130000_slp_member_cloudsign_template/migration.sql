-- SLP入会フォーム回答後の自動送付契約書を ContractType から CloudSignTemplate 直接参照に変更

-- 1. 旧FK制約削除
ALTER TABLE "master_projects" DROP CONSTRAINT IF EXISTS "master_projects_slp_member_contract_type_id_fkey";

-- 2. 旧カラム削除（未使用のためデータ移行不要）
ALTER TABLE "master_projects" DROP COLUMN IF EXISTS "slp_member_contract_type_id";

-- 3. 新カラム追加
ALTER TABLE "master_projects" ADD COLUMN "slp_member_cloudsign_template_id" INTEGER;

-- 4. 新FK制約追加
ALTER TABLE "master_projects"
  ADD CONSTRAINT "master_projects_slp_member_cloudsign_template_id_fkey"
  FOREIGN KEY ("slp_member_cloudsign_template_id")
  REFERENCES "cloudsign_templates"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;
