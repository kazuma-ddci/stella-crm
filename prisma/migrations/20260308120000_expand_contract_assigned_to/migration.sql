-- AlterTable: MasterContract.assigned_to を VarChar(100) から VarChar(500) に拡張（複数担当者対応）
ALTER TABLE "master_contracts" ALTER COLUMN "assigned_to" TYPE VARCHAR(500);
