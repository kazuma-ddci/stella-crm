-- AlterTable: Counterpartyにプロジェクト紐づけ用カラム追加
ALTER TABLE "Counterparty" ADD COLUMN "projectId" INTEGER;

-- CreateIndex: プロジェクトとの1対1制約
CREATE UNIQUE INDEX "Counterparty_projectId_key" ON "Counterparty"("projectId");

-- AddForeignKey
ALTER TABLE "Counterparty" ADD CONSTRAINT "Counterparty_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "master_projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;
