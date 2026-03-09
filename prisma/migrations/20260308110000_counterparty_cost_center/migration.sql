-- AlterTable: Counterpartyの紐づけ先をMasterProject → CostCenterに変更

-- 1. projectId のFK制約・ユニークインデックスを削除
ALTER TABLE "Counterparty" DROP CONSTRAINT IF EXISTS "Counterparty_projectId_fkey";
DROP INDEX IF EXISTS "Counterparty_projectId_key";

-- 2. projectId カラムを削除
ALTER TABLE "Counterparty" DROP COLUMN IF EXISTS "projectId";

-- 3. costCenterId カラムを追加
ALTER TABLE "Counterparty" ADD COLUMN "costCenterId" INTEGER;

-- 4. ユニークインデックス作成
CREATE UNIQUE INDEX "Counterparty_costCenterId_key" ON "Counterparty"("costCenterId");

-- 5. FK制約追加
ALTER TABLE "Counterparty" ADD CONSTRAINT "Counterparty_costCenterId_fkey" FOREIGN KEY ("costCenterId") REFERENCES "CostCenter"("id") ON DELETE SET NULL ON UPDATE CASCADE;
