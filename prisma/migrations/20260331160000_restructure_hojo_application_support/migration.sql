-- HojoApplicationSupport: FK変更（ShinseiSupport → JoseiSupport）+ 新カラム追加

-- 1. 既存データを削除（FKが間違ったテーブルを参照していたため）
DELETE FROM "hojo_application_supports";

-- 2. 既存のFK制約を削除
ALTER TABLE "hojo_application_supports" DROP CONSTRAINT IF EXISTS "hojo_application_supports_lineFriendId_fkey";

-- 3. lineFriendIdにUNIQUE制約を追加（1:1関係）
CREATE UNIQUE INDEX "hojo_application_supports_lineFriendId_key" ON "hojo_application_supports"("lineFriendId");

-- 4. 新しいFK制約を追加（JoseiSupportテーブルへ）
ALTER TABLE "hojo_application_supports" ADD CONSTRAINT "hojo_application_supports_lineFriendId_fkey" FOREIGN KEY ("lineFriendId") REFERENCES "hojo_line_friends_josei_support"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 5. vendorMemoカラムを削除（不要）
ALTER TABLE "hojo_application_supports" DROP COLUMN IF EXISTS "vendor_memo";

-- 6. 新カラム追加
ALTER TABLE "hojo_application_supports" ADD COLUMN "alkes_memo" TEXT;
ALTER TABLE "hojo_application_supports" ADD COLUMN "bbs_memo" TEXT;
ALTER TABLE "hojo_application_supports" ADD COLUMN "bbs_status" VARCHAR(50);

-- 7. HojoBbsAccountテーブル作成
CREATE TABLE "hojo_bbs_accounts" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "status" VARCHAR(30) NOT NULL DEFAULT 'pending_approval',
    "must_change_password" BOOLEAN NOT NULL DEFAULT false,
    "password_reset_requested_at" TIMESTAMP(3),
    "approved_at" TIMESTAMP(3),
    "approved_by" INTEGER,
    "last_login_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hojo_bbs_accounts_pkey" PRIMARY KEY ("id")
);

-- 8. HojoBbsAccountのインデックスとFK
CREATE UNIQUE INDEX "hojo_bbs_accounts_email_key" ON "hojo_bbs_accounts"("email");
ALTER TABLE "hojo_bbs_accounts" ADD CONSTRAINT "hojo_bbs_accounts_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "master_staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;
