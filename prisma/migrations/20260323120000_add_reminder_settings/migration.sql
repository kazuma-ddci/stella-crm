-- SlpMember: 自動リマインド除外フラグ
ALTER TABLE "slp_members" ADD COLUMN "reminderExcluded" BOOLEAN NOT NULL DEFAULT false;

-- MasterProject: リマインド日数設定
ALTER TABLE "master_projects" ADD COLUMN "reminder_days" INTEGER NOT NULL DEFAULT 7;
