-- コンサルティングプラン追加フィールド
ALTER TABLE "hojo_vendors" ADD COLUMN "consulting_contract_amount" DECIMAL(12,0);
ALTER TABLE "hojo_vendors" ADD COLUMN "success_fee" DECIMAL(12,0);
ALTER TABLE "hojo_vendors" ADD COLUMN "consulting_start_date" TIMESTAMP(3);
ALTER TABLE "hojo_vendors" ADD COLUMN "consulting_end_date" TIMESTAMP(3);
ALTER TABLE "hojo_vendors" ADD COLUMN "vendor_shared_memo" TEXT;

-- 担当AS
ALTER TABLE "hojo_vendors" ADD COLUMN "assigned_as_line_friend_id" INTEGER;
ALTER TABLE "hojo_vendors" ADD CONSTRAINT "hojo_vendors_assigned_as_line_friend_id_fkey"
  FOREIGN KEY ("assigned_as_line_friend_id") REFERENCES "hojo_line_friends_security_cloud"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- コンサル担当者（多対多中間テーブル）
CREATE TABLE "hojo_vendor_consulting_staff" (
    "id" SERIAL NOT NULL,
    "vendor_id" INTEGER NOT NULL,
    "staff_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "hojo_vendor_consulting_staff_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "hojo_vendor_consulting_staff_vendor_id_staff_id_key"
  ON "hojo_vendor_consulting_staff"("vendor_id", "staff_id");

ALTER TABLE "hojo_vendor_consulting_staff" ADD CONSTRAINT "hojo_vendor_consulting_staff_vendor_id_fkey"
  FOREIGN KEY ("vendor_id") REFERENCES "hojo_vendors"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "hojo_vendor_consulting_staff" ADD CONSTRAINT "hojo_vendor_consulting_staff_staff_id_fkey"
  FOREIGN KEY ("staff_id") REFERENCES "master_staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;
