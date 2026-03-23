-- MasterProject: 契約書自動送付ON/OFFフラグ
ALTER TABLE "master_projects" ADD COLUMN "auto_send_contract" BOOLEAN NOT NULL DEFAULT true;
