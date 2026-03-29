-- AlterTable: HojoVendor に accessToken カラム追加
-- AlterTable: HojoApplicationSupport に vendorMemo カラム追加

-- まず nullable で追加
ALTER TABLE "hojo_vendors" ADD COLUMN "access_token" VARCHAR(64);

-- 既存レコードにランダムトークンを生成（md5ベース）
UPDATE "hojo_vendors" SET "access_token" = md5(random()::text || clock_timestamp()::text || id::text) || md5(random()::text || id::text) WHERE "access_token" IS NULL;

-- NOT NULL + UNIQUE 制約を追加
ALTER TABLE "hojo_vendors" ALTER COLUMN "access_token" SET NOT NULL;
CREATE UNIQUE INDEX "hojo_vendors_access_token_key" ON "hojo_vendors"("access_token");

-- vendorMemo カラム追加
ALTER TABLE "hojo_application_supports" ADD COLUMN "vendor_memo" TEXT;
