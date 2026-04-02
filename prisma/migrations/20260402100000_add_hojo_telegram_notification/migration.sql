-- CreateTable: Telegram Bots
CREATE TABLE "hojo_telegram_bots" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "token" VARCHAR(255) NOT NULL,
    "chat_id" VARCHAR(50) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hojo_telegram_bots_pkey" PRIMARY KEY ("id")
);

-- CreateTable: Telegram Notification Rules
CREATE TABLE "hojo_telegram_notification_rules" (
    "id" SERIAL NOT NULL,
    "uuid" VARCHAR(36) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "bot_id" INTEGER NOT NULL,
    "event_type" VARCHAR(30) NOT NULL,
    "booking_prefix" VARCHAR(10),
    "topic_strategy" VARCHAR(20) NOT NULL,
    "fixed_topic_id" VARCHAR(50),
    "message_template" TEXT NOT NULL,
    "custom_params" JSONB,
    "include_form_fields" JSONB,
    "duplicate_lock_seconds" INTEGER NOT NULL DEFAULT 180,
    "line_account_type" VARCHAR(30),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hojo_telegram_notification_rules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "hojo_telegram_notification_rules_uuid_key" ON "hojo_telegram_notification_rules"("uuid");

-- CreateTable: Telegram Topic Mappings
CREATE TABLE "hojo_telegram_topic_mappings" (
    "id" SERIAL NOT NULL,
    "rule_id" INTEGER NOT NULL,
    "staff_name" VARCHAR(50) NOT NULL,
    "topic_id" VARCHAR(50) NOT NULL,
    "telegram_mention" VARCHAR(100),
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hojo_telegram_topic_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateTable: Telegram Notification Logs
CREATE TABLE "hojo_telegram_notification_logs" (
    "id" SERIAL NOT NULL,
    "rule_id" INTEGER NOT NULL,
    "request_hash" VARCHAR(64) NOT NULL,
    "status" VARCHAR(20) NOT NULL,
    "params" JSONB,
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hojo_telegram_notification_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "hojo_telegram_notification_logs_rule_id_request_hash_created_idx" ON "hojo_telegram_notification_logs"("rule_id", "request_hash", "created_at");

-- AddForeignKey
ALTER TABLE "hojo_telegram_notification_rules" ADD CONSTRAINT "hojo_telegram_notification_rules_bot_id_fkey" FOREIGN KEY ("bot_id") REFERENCES "hojo_telegram_bots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hojo_telegram_topic_mappings" ADD CONSTRAINT "hojo_telegram_topic_mappings_rule_id_fkey" FOREIGN KEY ("rule_id") REFERENCES "hojo_telegram_notification_rules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hojo_telegram_notification_logs" ADD CONSTRAINT "hojo_telegram_notification_logs_rule_id_fkey" FOREIGN KEY ("rule_id") REFERENCES "hojo_telegram_notification_rules"("id") ON DELETE CASCADE ON UPDATE CASCADE;
