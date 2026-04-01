-- SLPプロジェクトをmaster_projectsに追加（存在しない場合のみ）
INSERT INTO "master_projects" (code, name, description, "display_order", "is_active", "created_at", "updated_at")
SELECT 'slp', '公的制度教育推進協会', '公的制度教育推進協会', 4, true, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM "master_projects" WHERE "code" = 'slp');

-- システムユーザー（admin, test_user, stella001）にSLPプロジェクトの権限を付与
INSERT INTO "staff_permissions" ("staffId", "projectId", "permissionLevel", "createdAt", "updatedAt")
SELECT ms.id, mp.id, 'admin', NOW(), NOW()
FROM "master_staff" ms, "master_projects" mp
WHERE ms."loginId" IN ('admin', 'test_user', 'stella001')
  AND mp.code = 'slp'
  AND NOT EXISTS (
    SELECT 1 FROM "staff_permissions" sp
    WHERE sp."staffId" = ms.id AND sp."projectId" = mp.id
  );
