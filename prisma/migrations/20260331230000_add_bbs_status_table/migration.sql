-- BBSステータスマスタテーブル作成
CREATE TABLE "hojo_bbs_statuses" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hojo_bbs_statuses_pkey" PRIMARY KEY ("id")
);

-- デフォルトBBSステータスを挿入
INSERT INTO "hojo_bbs_statuses" ("id", "name", "display_order", "is_active", "createdAt", "updatedAt")
VALUES
    (1, '申請フォーム送信', 1, true, NOW(), NOW()),
    (2, '決定通知書受取', 2, true, NOW(), NOW()),
    (3, '請求書到着', 3, true, NOW(), NOW()),
    (4, 'ディディ振込済', 4, true, NOW(), NOW()),
    (5, 'お客様着金', 5, true, NOW(), NOW());

-- hojo_application_supports に bbs_status_id カラム追加
ALTER TABLE "hojo_application_supports" ADD COLUMN "bbs_status_id" INTEGER;

-- 外部キー制約追加
ALTER TABLE "hojo_application_supports" ADD CONSTRAINT "hojo_application_supports_bbs_status_id_fkey"
    FOREIGN KEY ("bbs_status_id") REFERENCES "hojo_bbs_statuses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 既存データの文字列 → ID 変換
UPDATE "hojo_application_supports" SET "bbs_status_id" = 1 WHERE "bbs_status" = '申請フォーム送信';
UPDATE "hojo_application_supports" SET "bbs_status_id" = 2 WHERE "bbs_status" = '決定通知書受取';
UPDATE "hojo_application_supports" SET "bbs_status_id" = 3 WHERE "bbs_status" = '請求書到着';
UPDATE "hojo_application_supports" SET "bbs_status_id" = 4 WHERE "bbs_status" = 'ディディ振込済';
UPDATE "hojo_application_supports" SET "bbs_status_id" = 5 WHERE "bbs_status" = 'お客様着金';
