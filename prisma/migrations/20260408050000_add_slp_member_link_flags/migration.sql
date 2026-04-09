-- AlterTable: SlpMember にリッチメニュー呼び出しフラグとCloudSign送信失敗関連を追加
ALTER TABLE "slp_members"
  ADD COLUMN "richmenu_beacon_called" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "cloudsign_bounced" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "cloudsign_bounced_at" TIMESTAMP(3),
  ADD COLUMN "cloudsign_bounced_email" VARCHAR(255);

-- AlterTable: MasterProject にForm5自動送信フラグを追加
ALTER TABLE "master_projects"
  ADD COLUMN "slp_form5_auto_send_on_link" BOOLEAN NOT NULL DEFAULT false;

-- 既存締結済みSlpMemberをリッチメニュー呼び出し済みにする（過去データの整合性のため）
UPDATE "slp_members"
  SET "richmenu_beacon_called" = true
  WHERE "status" = '組合員契約書締結';
