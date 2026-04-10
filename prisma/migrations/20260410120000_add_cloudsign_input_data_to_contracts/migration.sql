-- Add cloudsign_input_data (JSONB) to master_contracts
-- 締結完了時にCloudSignから取得した受信者の入力値（widget の label と text）を保存
ALTER TABLE "master_contracts"
  ADD COLUMN "cloudsign_input_data" JSONB;
