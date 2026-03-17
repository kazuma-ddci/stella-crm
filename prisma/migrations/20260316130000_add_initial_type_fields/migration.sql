-- AlterTable: StpAgentContractHistory に初期費用タイプ/固定額フィールドを追加
ALTER TABLE "stp_agent_contract_histories" ADD COLUMN "defaultMpInitialType" VARCHAR(10);
ALTER TABLE "stp_agent_contract_histories" ADD COLUMN "defaultMpInitialFixed" INTEGER;
ALTER TABLE "stp_agent_contract_histories" ADD COLUMN "defaultPpInitialType" VARCHAR(10);
ALTER TABLE "stp_agent_contract_histories" ADD COLUMN "defaultPpInitialFixed" INTEGER;

-- AlterTable: StpAgentCommissionOverride に初期費用タイプ/固定額フィールドを追加
ALTER TABLE "stp_agent_commission_overrides" ADD COLUMN "mpInitialType" VARCHAR(10);
ALTER TABLE "stp_agent_commission_overrides" ADD COLUMN "mpInitialFixed" INTEGER;
ALTER TABLE "stp_agent_commission_overrides" ADD COLUMN "ppInitialType" VARCHAR(10);
ALTER TABLE "stp_agent_commission_overrides" ADD COLUMN "ppInitialFixed" INTEGER;
