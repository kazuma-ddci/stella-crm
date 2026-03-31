-- AlterTable: HojoVendor に助成金申請サポートLINE友達IDを追加
ALTER TABLE "hojo_vendors" ADD COLUMN "josei_line_friend_id" INTEGER;

-- AddForeignKey
ALTER TABLE "hojo_vendors" ADD CONSTRAINT "hojo_vendors_josei_line_friend_id_fkey" FOREIGN KEY ("josei_line_friend_id") REFERENCES "hojo_line_friends_josei_support"("id") ON DELETE SET NULL ON UPDATE CASCADE;
