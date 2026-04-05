-- 案件ステータスマスタ
CREATE TABLE "hojo_vendor_case_statuses" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "hojo_vendor_case_statuses_pkey" PRIMARY KEY ("id")
);

-- HojoVendor に契約日・案件ステータス追加
ALTER TABLE "hojo_vendors" ADD COLUMN "contract_date" TIMESTAMP(3);
ALTER TABLE "hojo_vendors" ADD COLUMN "case_status_id" INTEGER;

ALTER TABLE "hojo_vendors" ADD CONSTRAINT "hojo_vendors_case_status_id_fkey"
  FOREIGN KEY ("case_status_id") REFERENCES "hojo_vendor_case_statuses"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
