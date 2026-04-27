-- ツールマスタ
CREATE TABLE "hojo_vendor_tools" (
  "id" SERIAL PRIMARY KEY,
  "name" VARCHAR(200) NOT NULL,
  "displayOrder" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);

-- ツール毎のステータスマスタ
CREATE TABLE "hojo_vendor_tool_statuses" (
  "id" SERIAL PRIMARY KEY,
  "tool_id" INTEGER NOT NULL,
  "name" VARCHAR(200) NOT NULL,
  "displayOrder" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "isCompleted" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "hojo_vendor_tool_statuses_tool_id_fkey"
    FOREIGN KEY ("tool_id") REFERENCES "hojo_vendor_tools"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "hojo_vendor_tool_statuses_tool_id_idx" ON "hojo_vendor_tool_statuses"("tool_id");

-- ベンダー × ツール 中間テーブル
CREATE TABLE "hojo_vendor_tool_registrations" (
  "id" SERIAL PRIMARY KEY,
  "vendor_id" INTEGER NOT NULL,
  "tool_id" INTEGER NOT NULL,
  "status_id" INTEGER,
  "memo" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "hojo_vendor_tool_registrations_vendor_id_fkey"
    FOREIGN KEY ("vendor_id") REFERENCES "hojo_vendors"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "hojo_vendor_tool_registrations_tool_id_fkey"
    FOREIGN KEY ("tool_id") REFERENCES "hojo_vendor_tools"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "hojo_vendor_tool_registrations_status_id_fkey"
    FOREIGN KEY ("status_id") REFERENCES "hojo_vendor_tool_statuses"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "hojo_vendor_tool_registrations_vendor_id_tool_id_key"
  ON "hojo_vendor_tool_registrations"("vendor_id", "tool_id");
CREATE INDEX "hojo_vendor_tool_registrations_tool_id_idx" ON "hojo_vendor_tool_registrations"("tool_id");

-- デフォルトのツール3種を投入
INSERT INTO "hojo_vendor_tools" ("name", "displayOrder", "updatedAt") VALUES
  ('セキュリティクラウド', 1, CURRENT_TIMESTAMP),
  ('PFU', 2, CURRENT_TIMESTAMP),
  ('アクシス', 3, CURRENT_TIMESTAMP);

-- 各ツールに共通のデフォルトステータスを投入（未登録 / 登録中 / 登録完了）
DO $$
DECLARE t RECORD;
BEGIN
  FOR t IN SELECT id FROM "hojo_vendor_tools" LOOP
    INSERT INTO "hojo_vendor_tool_statuses" ("tool_id", "name", "displayOrder", "isCompleted", "updatedAt") VALUES
      (t.id, '未登録',   1, false, CURRENT_TIMESTAMP),
      (t.id, '登録中',   2, false, CURRENT_TIMESTAMP),
      (t.id, '登録完了', 3, true,  CURRENT_TIMESTAMP);
  END LOOP;
END $$;
