-- StpCompanyContract テーブルを削除（MasterContractに統合済み）
DROP TABLE IF EXISTS "stp_company_contracts";

-- StpContractHistory に masterContractId を追加（契約書との紐付け用）
ALTER TABLE "stp_contract_histories" ADD COLUMN "masterContractId" INTEGER;

-- 外部キー制約
ALTER TABLE "stp_contract_histories" ADD CONSTRAINT "stp_contract_histories_masterContractId_fkey" FOREIGN KEY ("masterContractId") REFERENCES "master_contracts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- インデックス
CREATE INDEX "idx_stp_contract_histories_master_contract_id" ON "stp_contract_histories"("masterContractId");
