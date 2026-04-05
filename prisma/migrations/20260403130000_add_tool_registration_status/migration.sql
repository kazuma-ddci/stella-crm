-- ツール登録の有無 ステータスマスタ
CREATE TABLE "hojo_vendor_tool_registration_statuses" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "hojo_vendor_tool_registration_statuses_pkey" PRIMARY KEY ("id")
);

-- HojoVendor にカラム追加
ALTER TABLE "hojo_vendors" ADD COLUMN "tool_registration_status_id" INTEGER;

-- 外部キー
ALTER TABLE "hojo_vendors" ADD CONSTRAINT "hojo_vendors_tool_registration_status_id_fkey" FOREIGN KEY ("tool_registration_status_id") REFERENCES "hojo_vendor_tool_registration_statuses"("id") ON DELETE SET NULL ON UPDATE CASCADE;
