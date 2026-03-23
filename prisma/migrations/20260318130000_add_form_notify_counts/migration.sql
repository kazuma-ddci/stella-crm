-- AlterTable: SlpLineFriend に form4NotifyCount を追加
ALTER TABLE "slp_line_friends" ADD COLUMN "form4NotifyCount" INTEGER NOT NULL DEFAULT 0;

-- AlterTable: SlpMember に form5NotifyCount を追加
ALTER TABLE "slp_members" ADD COLUMN "form5NotifyCount" INTEGER NOT NULL DEFAULT 0;
