-- AlterTable: Transaction の contractId カラムを削除（CRM連携は stpContractHistoryId で行うため不要）
ALTER TABLE "Transaction" DROP COLUMN IF EXISTS "contractId";
