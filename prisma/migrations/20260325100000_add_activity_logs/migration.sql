-- CreateTable
CREATE TABLE "activity_logs" (
    "id" SERIAL NOT NULL,
    "table_name" VARCHAR(100) NOT NULL,
    "record_id" INTEGER NOT NULL,
    "action" VARCHAR(10) NOT NULL,
    "changes" JSONB,
    "user_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "activity_logs_table_name_record_id_idx" ON "activity_logs"("table_name", "record_id");
CREATE INDEX "activity_logs_user_id_idx" ON "activity_logs"("user_id");
CREATE INDEX "activity_logs_created_at_idx" ON "activity_logs"("created_at");

-- AddForeignKey
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "master_staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;
