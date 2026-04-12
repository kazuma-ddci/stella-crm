-- SlpMember: 送付履歴フロー制御フィールド追加
ALTER TABLE "slp_members" ADD COLUMN "bounce_confirmed_at" TIMESTAMP(3);
ALTER TABLE "slp_members" ADD COLUMN "bounce_fix_used" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "slp_members" ADD COLUMN "email_change_used" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "slp_members" ADD COLUMN "form_locked" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "slp_members" ADD COLUMN "auto_send_locked" BOOLEAN NOT NULL DEFAULT false;

-- SlpContractAttempt: 契約書送付履歴テーブル
CREATE TABLE "slp_contract_attempts" (
    "id" SERIAL NOT NULL,
    "slp_member_id" INTEGER NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "document_id" VARCHAR(255),
    "cloudsign_url" VARCHAR(500),
    "send_result" VARCHAR(20) NOT NULL,
    "cloudsign_status" VARCHAR(30),
    "trigger_type" VARCHAR(20) NOT NULL,
    "sequence" INTEGER NOT NULL,
    "manual_check_result" VARCHAR(20),
    "manual_check_at" TIMESTAMP(3),
    "manual_check_by" VARCHAR(100),
    "declined_at" TIMESTAMP(3),
    "declined_by" VARCHAR(100),
    "decline_error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "slp_contract_attempts_pkey" PRIMARY KEY ("id")
);

-- SlpUnmatchedBounce: 未照合バウンス通知テーブル
CREATE TABLE "slp_unmatched_bounces" (
    "id" SERIAL NOT NULL,
    "document_id" VARCHAR(255) NOT NULL,
    "bounced_email" VARCHAR(255) NOT NULL,
    "webhook_text" TEXT,
    "matched" BOOLEAN NOT NULL DEFAULT false,
    "matched_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "slp_unmatched_bounces_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE INDEX "slp_contract_attempts_slp_member_id_idx" ON "slp_contract_attempts"("slp_member_id");
CREATE INDEX "slp_contract_attempts_document_id_idx" ON "slp_contract_attempts"("document_id");
CREATE INDEX "slp_unmatched_bounces_document_id_idx" ON "slp_unmatched_bounces"("document_id");

-- Foreign Keys
ALTER TABLE "slp_contract_attempts" ADD CONSTRAINT "slp_contract_attempts_slp_member_id_fkey" FOREIGN KEY ("slp_member_id") REFERENCES "slp_members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
