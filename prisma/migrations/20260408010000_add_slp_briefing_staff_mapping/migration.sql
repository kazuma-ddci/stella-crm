-- CreateTable
CREATE TABLE "slp_briefing_staff_mappings" (
    "id" SERIAL NOT NULL,
    "briefing_staff_name" VARCHAR(100) NOT NULL,
    "line_friend_id" INTEGER,
    "staff_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "slp_briefing_staff_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "slp_briefing_staff_mappings_briefing_staff_name_key" ON "slp_briefing_staff_mappings"("briefing_staff_name");

-- AddForeignKey
ALTER TABLE "slp_briefing_staff_mappings" ADD CONSTRAINT "slp_briefing_staff_mappings_line_friend_id_fkey" FOREIGN KEY ("line_friend_id") REFERENCES "slp_line_friends"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "slp_briefing_staff_mappings" ADD CONSTRAINT "slp_briefing_staff_mappings_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "master_staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;
