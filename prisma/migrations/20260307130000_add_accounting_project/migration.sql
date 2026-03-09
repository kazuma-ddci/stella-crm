-- accounting プロジェクトを追加
INSERT INTO "master_projects" (code, name, description, "display_order", "is_active", "created_at", "updated_at")
SELECT 'accounting', '経理', '経理・会計管理', 5, true, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM "master_projects" WHERE "code" = 'accounting');
