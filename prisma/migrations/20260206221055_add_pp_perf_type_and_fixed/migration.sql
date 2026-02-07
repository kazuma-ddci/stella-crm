-- AlterTable
ALTER TABLE "stp_agent_commission_overrides" ADD COLUMN     "ppPerfFixed" INTEGER,
ADD COLUMN     "ppPerfType" VARCHAR(10);

-- AlterTable
ALTER TABLE "stp_agent_contract_histories" ADD COLUMN     "defaultPpPerfFixed" INTEGER,
ADD COLUMN     "defaultPpPerfType" VARCHAR(10);
