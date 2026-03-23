-- AlterTable: SlpMember に watermarkCode カラム追加
ALTER TABLE "slp_members" ADD COLUMN "watermarkCode" VARCHAR(9);

-- 既存レコードにユニークなウォーターマークコードを生成
UPDATE "slp_members"
SET "watermarkCode" = UPPER(
  SUBSTR(MD5(CAST(id AS TEXT) || uid || COALESCE(CAST("createdAt" AS TEXT), '')), 1, 4)
  || '-' ||
  SUBSTR(MD5(CAST(id AS TEXT) || uid || COALESCE(CAST("createdAt" AS TEXT), '')), 5, 4)
);

-- ユニーク制約追加
CREATE UNIQUE INDEX "slp_members_watermarkCode_key" ON "slp_members"("watermarkCode");
