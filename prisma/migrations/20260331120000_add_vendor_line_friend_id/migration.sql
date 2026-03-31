-- AlterTable: HojoVendor にセキュリティクラウドLINE友達IDを追加
ALTER TABLE "hojo_vendors" ADD COLUMN "line_friend_id" INTEGER;

-- AddForeignKey
ALTER TABLE "hojo_vendors" ADD CONSTRAINT "hojo_vendors_line_friend_id_fkey" FOREIGN KEY ("line_friend_id") REFERENCES "hojo_line_friends_security_cloud"("id") ON DELETE SET NULL ON UPDATE CASCADE;
