-- AlterTable: sortOrderカラム追加（ProLine同期時の連番）
ALTER TABLE "slp_line_friends" ADD COLUMN "sort_order" INTEGER NOT NULL DEFAULT 0;
