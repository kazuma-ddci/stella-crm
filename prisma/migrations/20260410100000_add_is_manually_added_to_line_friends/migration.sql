-- Add is_manually_added flag to slp_line_friends
-- true  = CRMから手動追加（編集・削除可）
-- false = プロライン同期/Webhook由来（編集・削除不可、デフォルト）
ALTER TABLE "slp_line_friends"
  ADD COLUMN "is_manually_added" BOOLEAN NOT NULL DEFAULT false;
