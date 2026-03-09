-- クラウドサイン連携 Phase 1: スキーマ変更
-- ============================================

-- 1. operating_companies: クラウドサイン設定カラム追加
-- cloudsignClientId は既存マイグレーション(20260308000000)で追加済みの場合がある
ALTER TABLE "operating_companies" ADD COLUMN IF NOT EXISTS "cloudsignClientId" VARCHAR(500);
ALTER TABLE "operating_companies" ADD COLUMN "cloudsign_registered_email" VARCHAR(255);

-- 2. contract_types: テンプレートID追加
ALTER TABLE "contract_types" ADD COLUMN "cloudsign_template_id" VARCHAR(100);

-- 3. master_contract_statuses: ステータスマッピング追加
ALTER TABLE "master_contract_statuses" ADD COLUMN "cloudsign_status_mapping" VARCHAR(30);

-- 4. master_contracts: クラウドサイン関連カラム追加
ALTER TABLE "master_contracts" ADD COLUMN IF NOT EXISTS "cloudsign_title" VARCHAR(200);
ALTER TABLE "master_contracts" ADD COLUMN IF NOT EXISTS "cloudsign_auto_sync" BOOLEAN NOT NULL DEFAULT true;

-- 5. contract_files テーブル作成
CREATE TABLE "contract_files" (
    "id" SERIAL PRIMARY KEY,
    "contract_id" INTEGER NOT NULL,
    "file_path" VARCHAR(500) NOT NULL,
    "file_name" VARCHAR(200) NOT NULL,
    "file_size" INTEGER,
    "mime_type" VARCHAR(100),
    "category" VARCHAR(30) NOT NULL DEFAULT 'other',
    "is_visible" BOOLEAN NOT NULL DEFAULT true,
    "uploaded_by" VARCHAR(100),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contract_files_contract_id_fkey"
        FOREIGN KEY ("contract_id") REFERENCES "master_contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "idx_contract_files_contract_id" ON "contract_files"("contract_id");

-- 6. contract_relations テーブル作成
CREATE TABLE "contract_relations" (
    "id" SERIAL PRIMARY KEY,
    "source_contract_id" INTEGER NOT NULL,
    "target_contract_id" INTEGER NOT NULL,
    "relation_type" VARCHAR(30) NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contract_relations_source_contract_id_fkey"
        FOREIGN KEY ("source_contract_id") REFERENCES "master_contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "contract_relations_target_contract_id_fkey"
        FOREIGN KEY ("target_contract_id") REFERENCES "master_contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "idx_contract_relations_source" ON "contract_relations"("source_contract_id");
CREATE INDEX "idx_contract_relations_target" ON "contract_relations"("target_contract_id");

-- 7. ステータスマスタの更新
-- 7a. 新ステータスを追加（下書き中、先方破棄、弊社破棄）
INSERT INTO "master_contract_statuses" ("id", "name", "display_order", "is_terminal", "is_active", "created_at", "updated_at")
VALUES
    (9, '下書き中', 9, false, true, NOW(), NOW()),
    (10, '先方破棄', 10, true, true, NOW(), NOW()),
    (11, '弊社破棄', 11, true, true, NOW(), NOW())
ON CONFLICT ("id") DO NOTHING;

-- 7b. ステータスマッピングを設定
UPDATE "master_contract_statuses" SET "cloudsign_status_mapping" = 'sent' WHERE "id" = 6;
UPDATE "master_contract_statuses" SET "cloudsign_status_mapping" = 'completed' WHERE "id" = 7;
UPDATE "master_contract_statuses" SET "cloudsign_status_mapping" = 'draft' WHERE "id" = 9;
UPDATE "master_contract_statuses" SET "cloudsign_status_mapping" = 'canceled_by_recipient' WHERE "id" = 10;
UPDATE "master_contract_statuses" SET "cloudsign_status_mapping" = 'canceled_by_sender' WHERE "id" = 11;

-- 7c. id:8「破棄」の参照を id:11「弊社破棄」に移行
UPDATE "master_contracts" SET "current_status_id" = 11 WHERE "current_status_id" = 8;
UPDATE "master_contract_status_histories" SET "from_status_id" = 11 WHERE "from_status_id" = 8;
UPDATE "master_contract_status_histories" SET "to_status_id" = 11 WHERE "to_status_id" = 8;

-- 7d. id:8「破棄」を削除
DELETE FROM "master_contract_statuses" WHERE "id" = 8;

-- 8. 既存ファイルデータの移行（master_contracts → contract_files）
INSERT INTO "contract_files" ("contract_id", "file_path", "file_name", "category", "is_visible", "created_at")
SELECT "id", "file_path", "file_name", 'other', true, "created_at"
FROM "master_contracts"
WHERE "file_path" IS NOT NULL AND "file_name" IS NOT NULL;

-- ※ file_path/file_name カラムは Phase 2 で UI 更新後に削除予定
-- シーケンスのリセット（新しいIDが衝突しないように）
SELECT setval(pg_get_serial_sequence('master_contract_statuses', 'id'), GREATEST((SELECT MAX(id) FROM master_contract_statuses), 11));
