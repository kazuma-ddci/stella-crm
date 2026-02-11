-- 外部ユーザー表示区分の初期データ投入
INSERT INTO display_views ("viewKey", "viewName", "projectId", "isActive", description, "createdAt", "updatedAt")
SELECT 'stp_client', '採用ブースト（企業版）', id, true, '', NOW(), NOW()
FROM master_projects WHERE code = 'stp'
ON CONFLICT ("viewKey") DO NOTHING;

INSERT INTO display_views ("viewKey", "viewName", "projectId", "isActive", description, "createdAt", "updatedAt")
SELECT 'stp_agent', '採用ブースト（代理店版）', id, true, '', NOW(), NOW()
FROM master_projects WHERE code = 'stp'
ON CONFLICT ("viewKey") DO NOTHING;
