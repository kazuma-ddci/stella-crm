-- DropForeignKey
ALTER TABLE "slp_as" DROP CONSTRAINT IF EXISTS "slp_as_proline_account_id_fkey";

-- DropColumn
ALTER TABLE "slp_as" DROP COLUMN IF EXISTS "proline_account_id";

-- AddColumn
ALTER TABLE "slp_as" ADD COLUMN "line_friend_id" INTEGER;
ALTER TABLE "slp_as" ADD COLUMN "staff_id" INTEGER;

-- AddForeignKey
ALTER TABLE "slp_as" ADD CONSTRAINT "slp_as_line_friend_id_fkey" FOREIGN KEY ("line_friend_id") REFERENCES "slp_line_friends"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "slp_as" ADD CONSTRAINT "slp_as_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "master_staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;
