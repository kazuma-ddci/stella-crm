-- AlterTable: MasterContractStatus に statusType カラムを追加
ALTER TABLE "master_contract_statuses" ADD COLUMN "status_type" VARCHAR(20) NOT NULL DEFAULT 'progress';

-- 既存データのマイグレーション: isTerminal=true のレコードを名前で判定
UPDATE "master_contract_statuses" SET "status_type" = 'signed' WHERE "is_terminal" = true AND "name" LIKE '%締結%';
UPDATE "master_contract_statuses" SET "status_type" = 'discarded' WHERE "is_terminal" = true AND "name" LIKE '%破棄%';
