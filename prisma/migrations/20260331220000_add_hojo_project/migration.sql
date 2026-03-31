-- 補助金プロジェクトをmaster_projectsに追加
INSERT INTO "master_projects" ("id", "code", "name", "description", "display_order", "is_active", "created_at", "updated_at")
VALUES (7, 'hojo', '補助金', '補助金申請・LINE友達管理・セキュリティクラウド', 6, true, NOW(), NOW())
ON CONFLICT ("id") DO NOTHING;

-- 管理者（staffId=10）に補助金プロジェクトの権限を追加
INSERT INTO "staff_permissions" ("staffId", "projectId", "permissionLevel", "createdAt", "updatedAt")
VALUES (10, 7, 'manager', NOW(), NOW())
ON CONFLICT ("staffId", "projectId") DO NOTHING;

-- システム管理者（staffId=11）に補助金プロジェクトの権限を追加
INSERT INTO "staff_permissions" ("staffId", "projectId", "permissionLevel", "createdAt", "updatedAt")
VALUES (11, 7, 'manager', NOW(), NOW())
ON CONFLICT ("staffId", "projectId") DO NOTHING;

-- テストユーザー（staffId=12）に補助金プロジェクトの権限を追加
INSERT INTO "staff_permissions" ("staffId", "projectId", "permissionLevel", "createdAt", "updatedAt")
VALUES (12, 7, 'manager', NOW(), NOW())
ON CONFLICT ("staffId", "projectId") DO NOTHING;
