-- 新しいJSON列を追加
ALTER TABLE "hojo_consulting_activities" ADD COLUMN "attachment_urls" JSONB;
ALTER TABLE "hojo_consulting_activities" ADD COLUMN "recording_urls" JSONB;
ALTER TABLE "hojo_consulting_activities" ADD COLUMN "screenshot_urls" JSONB;

-- 既存データを JSON 配列に移行
UPDATE "hojo_consulting_activities"
SET "attachment_urls" = to_jsonb(ARRAY["attachment_url"]::text[])
WHERE "attachment_url" IS NOT NULL AND "attachment_url" <> '';

UPDATE "hojo_consulting_activities"
SET "recording_urls" = to_jsonb(ARRAY["recording_url"]::text[])
WHERE "recording_url" IS NOT NULL AND "recording_url" <> '';

UPDATE "hojo_consulting_activities"
SET "screenshot_urls" = to_jsonb(ARRAY["screenshot_url"]::text[])
WHERE "screenshot_url" IS NOT NULL AND "screenshot_url" <> '';

-- 古い列を削除
ALTER TABLE "hojo_consulting_activities" DROP COLUMN "attachment_url";
ALTER TABLE "hojo_consulting_activities" DROP COLUMN "recording_url";
ALTER TABLE "hojo_consulting_activities" DROP COLUMN "screenshot_url";
