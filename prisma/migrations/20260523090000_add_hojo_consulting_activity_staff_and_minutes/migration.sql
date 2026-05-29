ALTER TABLE "hojo_consulting_activities"
  ADD COLUMN "title" VARCHAR(200),
  ADD COLUMN "meeting_minutes" TEXT;

CREATE TABLE "hojo_consulting_activity_staff" (
  "id" SERIAL NOT NULL,
  "activity_id" INTEGER NOT NULL,
  "staff_id" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "hojo_consulting_activity_staff_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "hojo_consulting_activity_staff_activity_id_staff_id_key"
  ON "hojo_consulting_activity_staff"("activity_id", "staff_id");

CREATE INDEX "hojo_consulting_activity_staff_activity_id_idx"
  ON "hojo_consulting_activity_staff"("activity_id");

CREATE INDEX "hojo_consulting_activity_staff_staff_id_idx"
  ON "hojo_consulting_activity_staff"("staff_id");

ALTER TABLE "hojo_consulting_activity_staff"
  ADD CONSTRAINT "hojo_consulting_activity_staff_activity_id_fkey"
  FOREIGN KEY ("activity_id") REFERENCES "hojo_consulting_activities"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "hojo_consulting_activity_staff"
  ADD CONSTRAINT "hojo_consulting_activity_staff_staff_id_fkey"
  FOREIGN KEY ("staff_id") REFERENCES "master_staff"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
