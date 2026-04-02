-- AlterTable: Add chat_id to rules
ALTER TABLE "hojo_telegram_notification_rules" ADD COLUMN "chat_id" VARCHAR(50) NOT NULL DEFAULT '';

-- Migrate existing data: copy chat_id from bot to rules
UPDATE "hojo_telegram_notification_rules" r
SET "chat_id" = b."chat_id"
FROM "hojo_telegram_bots" b
WHERE r."bot_id" = b."id";

-- AlterTable: Remove chat_id from bots
ALTER TABLE "hojo_telegram_bots" DROP COLUMN "chat_id";

-- Remove default after migration
ALTER TABLE "hojo_telegram_notification_rules" ALTER COLUMN "chat_id" DROP DEFAULT;
