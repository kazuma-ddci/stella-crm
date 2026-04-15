-- AlterTable: add postLinkSentBeaconCalled flag
ALTER TABLE "slp_members"
  ADD COLUMN "post_link_sent_beacon_called" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable: slp_line_link_requests
CREATE TABLE "slp_line_link_requests" (
    "id" SERIAL NOT NULL,
    "uid" VARCHAR(100) NOT NULL,
    "submitted_line_name" VARCHAR(200),
    "submitted_email" VARCHAR(255) NOT NULL,
    "status" VARCHAR(50) NOT NULL,
    "review_reason" VARCHAR(50),
    "resolved_member_id" INTEGER,
    "resolved_at" TIMESTAMP(3),
    "resolved_by_staff_id" INTEGER,
    "beacon_called_at" TIMESTAMP(3),
    "beacon_type" VARCHAR(20),
    "staff_note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "slp_line_link_requests_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "slp_line_link_requests_uid_key" ON "slp_line_link_requests"("uid");
CREATE INDEX "slp_line_link_requests_status_idx" ON "slp_line_link_requests"("status");
CREATE INDEX "slp_line_link_requests_submitted_email_idx" ON "slp_line_link_requests"("submitted_email");
CREATE INDEX "slp_line_link_requests_resolved_member_id_idx" ON "slp_line_link_requests"("resolved_member_id");

ALTER TABLE "slp_line_link_requests"
  ADD CONSTRAINT "slp_line_link_requests_resolved_member_id_fkey"
  FOREIGN KEY ("resolved_member_id") REFERENCES "slp_members"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
