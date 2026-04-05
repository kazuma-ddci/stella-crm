-- CreateTable
CREATE TABLE "hojo_consulting_activity_tasks" (
    "id" SERIAL NOT NULL,
    "activity_id" INTEGER NOT NULL,
    "task_type" VARCHAR(20) NOT NULL,
    "content" TEXT,
    "deadline" TIMESTAMP(3),
    "priority" VARCHAR(20),
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hojo_consulting_activity_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "hojo_consulting_activity_tasks_activity_id_idx" ON "hojo_consulting_activity_tasks"("activity_id");

-- AddForeignKey
ALTER TABLE "hojo_consulting_activity_tasks" ADD CONSTRAINT "hojo_consulting_activity_tasks_activity_id_fkey" FOREIGN KEY ("activity_id") REFERENCES "hojo_consulting_activities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 既存データを移行: vendorTask
INSERT INTO "hojo_consulting_activity_tasks" ("activity_id", "task_type", "content", "deadline", "priority", "completed", "display_order", "updatedAt")
SELECT id, 'vendor', vendor_task, vendor_task_deadline, vendor_task_priority, vendor_task_completed, 0, CURRENT_TIMESTAMP
FROM "hojo_consulting_activities"
WHERE vendor_task IS NOT NULL AND vendor_task <> '';

-- 既存データを移行: supportTask → consulting_team
INSERT INTO "hojo_consulting_activity_tasks" ("activity_id", "task_type", "content", "deadline", "priority", "completed", "display_order", "updatedAt")
SELECT id, 'consulting_team', support_task, support_task_deadline, support_task_priority, support_task_completed, 0, CURRENT_TIMESTAMP
FROM "hojo_consulting_activities"
WHERE support_task IS NOT NULL AND support_task <> '';
