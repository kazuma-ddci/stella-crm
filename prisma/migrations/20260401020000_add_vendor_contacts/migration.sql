-- HojoVendorContact テーブル作成（1ベンダーに複数のLINEユーザーを紐付け）
CREATE TABLE "hojo_vendor_contacts" (
    "id" SERIAL NOT NULL,
    "vendor_id" INTEGER NOT NULL,
    "line_friend_id" INTEGER,
    "josei_line_friend_id" INTEGER,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hojo_vendor_contacts_pkey" PRIMARY KEY ("id")
);

-- Foreign keys
ALTER TABLE "hojo_vendor_contacts" ADD CONSTRAINT "hojo_vendor_contacts_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "hojo_vendors"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "hojo_vendor_contacts" ADD CONSTRAINT "hojo_vendor_contacts_line_friend_id_fkey" FOREIGN KEY ("line_friend_id") REFERENCES "hojo_line_friends_security_cloud"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "hojo_vendor_contacts" ADD CONSTRAINT "hojo_vendor_contacts_josei_line_friend_id_fkey" FOREIGN KEY ("josei_line_friend_id") REFERENCES "hojo_line_friends_josei_support"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 既存データの移行: HojoVendor.lineFriendId / joseiLineFriendId → HojoVendorContact (isPrimary=true)
INSERT INTO "hojo_vendor_contacts" ("vendor_id", "line_friend_id", "josei_line_friend_id", "is_primary")
SELECT "id", "line_friend_id", "josei_line_friend_id", true
FROM "hojo_vendors"
WHERE "line_friend_id" IS NOT NULL OR "josei_line_friend_id" IS NOT NULL;
