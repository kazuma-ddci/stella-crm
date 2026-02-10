-- projectCode (文字列) → projectId (外部キー) への移行
-- StaffPermission, DisplayView, AccountingReconciliation の3テーブルが対象

-- ============================================
-- 1. "stella" プロジェクトを MasterProject に追加（存在しない場合）
-- ============================================
INSERT INTO "master_projects" ("code", "name", "is_active", "display_order", "created_at", "updated_at")
SELECT 'stella', 'Stella', true, 0, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM "master_projects" WHERE "code" = 'stella');

-- ============================================
-- 2. StaffPermission: projectCode → projectId
-- ============================================

-- 2a. 新カラム追加（nullable）
ALTER TABLE "staff_permissions" ADD COLUMN "projectId" INTEGER;

-- 2b. データ変換: projectCode → projectId（JOINで解決）
UPDATE "staff_permissions" sp
SET "projectId" = mp.id
FROM "master_projects" mp
WHERE sp."projectCode" = mp."code";

-- 2c. マッチしなかった行を削除（proj_xxx 等のゴミデータ）
DELETE FROM "staff_permissions" WHERE "projectId" IS NULL;

-- 2d. NOT NULL 制約追加
ALTER TABLE "staff_permissions" ALTER COLUMN "projectId" SET NOT NULL;

-- 2e. 旧ユニーク制約を DROP
ALTER TABLE "staff_permissions" DROP CONSTRAINT IF EXISTS "staff_permissions_staffId_projectCode_key";

-- 2f. 旧カラムを DROP
ALTER TABLE "staff_permissions" DROP COLUMN "projectCode";

-- 2g. 新FK制約・新ユニーク制約を作成
ALTER TABLE "staff_permissions" ADD CONSTRAINT "staff_permissions_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "master_projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "staff_permissions" ADD CONSTRAINT "staff_permissions_staffId_projectId_key" UNIQUE ("staffId", "projectId");

-- ============================================
-- 3. DisplayView: projectCode → projectId
-- ============================================

-- 3a. 新カラム追加（nullable）
ALTER TABLE "display_views" ADD COLUMN "projectId" INTEGER;

-- 3b. データ変換
UPDATE "display_views" dv
SET "projectId" = mp.id
FROM "master_projects" mp
WHERE dv."projectCode" = mp."code";

-- 3c. マッチしなかった行を削除
DELETE FROM "display_views" WHERE "projectId" IS NULL;

-- 3d. NOT NULL 制約追加
ALTER TABLE "display_views" ALTER COLUMN "projectId" SET NOT NULL;

-- 3e. 旧カラムを DROP
ALTER TABLE "display_views" DROP COLUMN "projectCode";

-- 3f. 新FK制約を作成
ALTER TABLE "display_views" ADD CONSTRAINT "display_views_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "master_projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ============================================
-- 4. AccountingReconciliation: projectCode → projectId
-- ============================================

-- 4a. 新カラム追加（nullable）
ALTER TABLE "accounting_reconciliations" ADD COLUMN "projectId" INTEGER;

-- 4b. データ変換（大文字小文字を揃える: "STP" → "stp"）
UPDATE "accounting_reconciliations" ar
SET "projectId" = mp.id
FROM "master_projects" mp
WHERE LOWER(ar."projectCode") = mp."code";

-- 4c. マッチしなかった行を削除
DELETE FROM "accounting_reconciliations" WHERE "projectId" IS NULL AND "projectCode" IS NOT NULL;

-- 4d. テーブルにデータがある場合のみ NOT NULL を設定
-- (空テーブルなので常に成功するが、安全のためデータ変換後に設定)
ALTER TABLE "accounting_reconciliations" ALTER COLUMN "projectId" SET NOT NULL;

-- 4e. 旧インデックスを DROP
DROP INDEX IF EXISTS "accounting_reconciliations_projectCode_idx";

-- 4f. 旧カラムを DROP
ALTER TABLE "accounting_reconciliations" DROP COLUMN "projectCode";

-- 4g. 新FK制約・新インデックスを作成
ALTER TABLE "accounting_reconciliations" ADD CONSTRAINT "accounting_reconciliations_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "master_projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "accounting_reconciliations_projectId_idx" ON "accounting_reconciliations"("projectId");
