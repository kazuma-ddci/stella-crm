-- CreateTable
CREATE TABLE "alert_acknowledgments" (
    "id" SERIAL NOT NULL,
    "alert_type" VARCHAR(50) NOT NULL,
    "alert_key" VARCHAR(200) NOT NULL,
    "staff_id" INTEGER,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "alert_acknowledgments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "alert_acknowledgments_alert_type_alert_key_key" ON "alert_acknowledgments"("alert_type", "alert_key");

-- AddForeignKey
ALTER TABLE "alert_acknowledgments" ADD CONSTRAINT "alert_acknowledgments_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "master_staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;
