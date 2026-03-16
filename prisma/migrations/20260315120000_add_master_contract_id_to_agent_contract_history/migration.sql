-- AlterTable
ALTER TABLE "stp_agent_contract_histories" ADD COLUMN "master_contract_id" INTEGER;

-- CreateIndex
CREATE INDEX "stp_agent_contract_histories_master_contract_id_idx" ON "stp_agent_contract_histories"("master_contract_id");

-- AddForeignKey
ALTER TABLE "stp_agent_contract_histories" ADD CONSTRAINT "stp_agent_contract_histories_master_contract_id_fkey" FOREIGN KEY ("master_contract_id") REFERENCES "master_contracts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
