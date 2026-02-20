-- 既存プロジェクトの display_order を +1 して common の挿入スペースを作る
UPDATE "master_projects" SET "display_order" = "display_order" + 1 WHERE code IN ('stp', 'srd', 'slo');

-- common プロジェクトを追加
INSERT INTO "master_projects" (code, name, description, "display_order", "is_active", "created_at", "updated_at")
VALUES ('common', '共通', '企業マスタ・スタッフ管理等の共通機能', 1, true, NOW(), NOW());
