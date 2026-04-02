-- CreateTable: Telegram Groups
CREATE TABLE "hojo_telegram_groups" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "chat_id" VARCHAR(50) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "hojo_telegram_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable: Telegram Topics
CREATE TABLE "hojo_telegram_topics" (
    "id" SERIAL NOT NULL,
    "group_id" INTEGER NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "topic_id" VARCHAR(50) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "hojo_telegram_topics_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey: Topics -> Groups
ALTER TABLE "hojo_telegram_topics" ADD CONSTRAINT "hojo_telegram_topics_group_id_fkey"
    FOREIGN KEY ("group_id") REFERENCES "hojo_telegram_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable: Rules - add group_id FK, change fixed_topic_id to integer FK
ALTER TABLE "hojo_telegram_notification_rules" ADD COLUMN "group_id" INTEGER;

-- Drop old chat_id and fixed_topic_id columns, replace with new FK columns
ALTER TABLE "hojo_telegram_notification_rules" DROP COLUMN "chat_id";
ALTER TABLE "hojo_telegram_notification_rules" DROP COLUMN "fixed_topic_id";
ALTER TABLE "hojo_telegram_notification_rules" ADD COLUMN "fixed_topic_id" INTEGER;

-- AddForeignKey: Rules -> Groups
ALTER TABLE "hojo_telegram_notification_rules" ADD CONSTRAINT "hojo_telegram_notification_rules_group_id_fkey"
    FOREIGN KEY ("group_id") REFERENCES "hojo_telegram_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: Rules -> Topics (fixed topic)
ALTER TABLE "hojo_telegram_notification_rules" ADD CONSTRAINT "hojo_telegram_notification_rules_fixed_topic_id_fkey"
    FOREIGN KEY ("fixed_topic_id") REFERENCES "hojo_telegram_topics"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable: TopicMappings - change topic_id string to telegram_topic_id integer FK
ALTER TABLE "hojo_telegram_topic_mappings" DROP COLUMN "topic_id";
ALTER TABLE "hojo_telegram_topic_mappings" ADD COLUMN "telegram_topic_id" INTEGER;

-- AddForeignKey: TopicMappings -> Topics
ALTER TABLE "hojo_telegram_topic_mappings" ADD CONSTRAINT "hojo_telegram_topic_mappings_telegram_topic_id_fkey"
    FOREIGN KEY ("telegram_topic_id") REFERENCES "hojo_telegram_topics"("id") ON DELETE SET NULL ON UPDATE CASCADE;
