-- ============================================
-- SLP接触履歴機能の追加 + 顧客種別マスタにシステムコード追加
-- ============================================

-- 1. 顧客種別マスタに code カラムを追加（最初は NULL 許容）
ALTER TABLE "customer_types" ADD COLUMN "code" VARCHAR(50);

-- 2. 既存の STP 顧客種別（id=1「企業」, id=2「代理店」）に system code を付与
UPDATE "customer_types" SET "code" = 'stp_company' WHERE "id" = 1;
UPDATE "customer_types" SET "code" = 'stp_agency'  WHERE "id" = 2;

-- 3. 本番以外にのみ存在する SRD / SLP 初期データ（projectId=2,3）のうち code 未付与のものを削除
--    （本番には存在しないので、削除対象はdev/stg環境のみ）
DELETE FROM "customer_types" WHERE "code" IS NULL;

-- 4. code を NOT NULL に変更
ALTER TABLE "customer_types" ALTER COLUMN "code" SET NOT NULL;

-- 5. (projectId, code) にユニーク制約を追加
CREATE UNIQUE INDEX "customer_types_project_id_code_key" ON "customer_types"("project_id", "code");

-- 6. SLP用の初期データ投入（事業者・代理店）
INSERT INTO "customer_types" ("project_id", "code", "name", "display_order", "is_active", "created_at", "updated_at")
SELECT mp."id", 'slp_company', '事業者', 1, TRUE, NOW(), NOW()
FROM "master_projects" mp WHERE mp."code" = 'slp'
ON CONFLICT DO NOTHING;

INSERT INTO "customer_types" ("project_id", "code", "name", "display_order", "is_active", "created_at", "updated_at")
SELECT mp."id", 'slp_agency', '代理店', 2, TRUE, NOW(), NOW()
FROM "master_projects" mp WHERE mp."code" = 'slp'
ON CONFLICT DO NOTHING;

-- ============================================
-- 事業者名簿・代理店管理に全顧客マスタ紐付け用のカラムを追加
-- ============================================

ALTER TABLE "slp_company_records" ADD COLUMN "master_company_id" INTEGER;
CREATE INDEX "slp_company_records_master_company_id_idx" ON "slp_company_records"("master_company_id");
ALTER TABLE "slp_company_records"
  ADD CONSTRAINT "slp_company_records_master_company_id_fkey"
  FOREIGN KEY ("master_company_id") REFERENCES "master_stella_companies"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "slp_agencies" ADD COLUMN "master_company_id" INTEGER;
CREATE INDEX "slp_agencies_master_company_id_idx" ON "slp_agencies"("master_company_id");
ALTER TABLE "slp_agencies"
  ADD CONSTRAINT "slp_agencies_master_company_id_fkey"
  FOREIGN KEY ("master_company_id") REFERENCES "master_stella_companies"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- ============================================
-- SLP接触履歴テーブル本体
-- ============================================

CREATE TABLE "slp_contact_histories" (
  "id"                    SERIAL         NOT NULL,
  "contact_date"          TIMESTAMP(3)   NOT NULL,
  "contact_method_id"     INTEGER,
  "contact_category_id"   INTEGER,
  "assigned_to"           VARCHAR(500),
  "customer_participants" VARCHAR(500),
  "meeting_minutes"       TEXT,
  "note"                  TEXT,
  "staff_id"              INTEGER,
  "target_type"           VARCHAR(30)    NOT NULL,
  "company_record_id"     INTEGER,
  "agency_id"             INTEGER,
  "master_company_id"     INTEGER,
  "created_at"            TIMESTAMP(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"            TIMESTAMP(3)   NOT NULL,
  "deleted_at"            TIMESTAMP(3),
  CONSTRAINT "slp_contact_histories_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "slp_contact_histories_target_type_deleted_at_idx"     ON "slp_contact_histories"("target_type", "deleted_at");
CREATE INDEX "slp_contact_histories_company_record_id_deleted_at_idx" ON "slp_contact_histories"("company_record_id", "deleted_at");
CREATE INDEX "slp_contact_histories_agency_id_deleted_at_idx"       ON "slp_contact_histories"("agency_id", "deleted_at");
CREATE INDEX "slp_contact_histories_contact_date_idx"               ON "slp_contact_histories"("contact_date");
CREATE INDEX "slp_contact_histories_contact_method_id_idx"          ON "slp_contact_histories"("contact_method_id");
CREATE INDEX "slp_contact_histories_contact_category_id_idx"        ON "slp_contact_histories"("contact_category_id");
CREATE INDEX "slp_contact_histories_staff_id_idx"                   ON "slp_contact_histories"("staff_id");
CREATE INDEX "slp_contact_histories_master_company_id_idx"          ON "slp_contact_histories"("master_company_id");

ALTER TABLE "slp_contact_histories"
  ADD CONSTRAINT "slp_contact_histories_contact_method_id_fkey"
  FOREIGN KEY ("contact_method_id") REFERENCES "contact_methods"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "slp_contact_histories"
  ADD CONSTRAINT "slp_contact_histories_contact_category_id_fkey"
  FOREIGN KEY ("contact_category_id") REFERENCES "contact_categories"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "slp_contact_histories"
  ADD CONSTRAINT "slp_contact_histories_staff_id_fkey"
  FOREIGN KEY ("staff_id") REFERENCES "master_staff"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "slp_contact_histories"
  ADD CONSTRAINT "slp_contact_histories_company_record_id_fkey"
  FOREIGN KEY ("company_record_id") REFERENCES "slp_company_records"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "slp_contact_histories"
  ADD CONSTRAINT "slp_contact_histories_agency_id_fkey"
  FOREIGN KEY ("agency_id") REFERENCES "slp_agencies"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "slp_contact_histories"
  ADD CONSTRAINT "slp_contact_histories_master_company_id_fkey"
  FOREIGN KEY ("master_company_id") REFERENCES "master_stella_companies"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- ============================================
-- SLP接触履歴 × 顧客種別（クロスプロジェクトタグ）
-- ============================================

CREATE TABLE "slp_contact_history_tags" (
  "contact_history_id" INTEGER       NOT NULL,
  "customer_type_id"   INTEGER       NOT NULL,
  "created_at"         TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "slp_contact_history_tags_pkey" PRIMARY KEY ("contact_history_id", "customer_type_id")
);

CREATE INDEX "slp_contact_history_tags_customer_type_id_idx" ON "slp_contact_history_tags"("customer_type_id");

ALTER TABLE "slp_contact_history_tags"
  ADD CONSTRAINT "slp_contact_history_tags_contact_history_id_fkey"
  FOREIGN KEY ("contact_history_id") REFERENCES "slp_contact_histories"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "slp_contact_history_tags"
  ADD CONSTRAINT "slp_contact_history_tags_customer_type_id_fkey"
  FOREIGN KEY ("customer_type_id") REFERENCES "customer_types"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- ============================================
-- SLP接触履歴 × 公式LINE友達情報（複数選択）
-- ============================================

CREATE TABLE "slp_contact_history_line_friends" (
  "contact_history_id" INTEGER       NOT NULL,
  "line_friend_id"     INTEGER       NOT NULL,
  "created_at"         TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "slp_contact_history_line_friends_pkey" PRIMARY KEY ("contact_history_id", "line_friend_id")
);

CREATE INDEX "slp_contact_history_line_friends_line_friend_id_idx" ON "slp_contact_history_line_friends"("line_friend_id");

ALTER TABLE "slp_contact_history_line_friends"
  ADD CONSTRAINT "slp_contact_history_line_friends_contact_history_id_fkey"
  FOREIGN KEY ("contact_history_id") REFERENCES "slp_contact_histories"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "slp_contact_history_line_friends"
  ADD CONSTRAINT "slp_contact_history_line_friends_line_friend_id_fkey"
  FOREIGN KEY ("line_friend_id") REFERENCES "slp_line_friends"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================
-- SLP接触履歴の添付ファイル
-- ============================================

CREATE TABLE "slp_contact_history_files" (
  "id"                 SERIAL         NOT NULL,
  "contact_history_id" INTEGER        NOT NULL,
  "file_path"          VARCHAR(500)   NOT NULL,
  "file_name"          VARCHAR(200)   NOT NULL,
  "file_size"          INTEGER        NOT NULL,
  "mime_type"          VARCHAR(100)   NOT NULL,
  "created_at"         TIMESTAMP(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "slp_contact_history_files_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "slp_contact_history_files_contact_history_id_idx" ON "slp_contact_history_files"("contact_history_id");

ALTER TABLE "slp_contact_history_files"
  ADD CONSTRAINT "slp_contact_history_files_contact_history_id_fkey"
  FOREIGN KEY ("contact_history_id") REFERENCES "slp_contact_histories"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
