-- Convert permission_level 'admin' to 'manager' in staff_permissions
UPDATE "staff_permissions" SET "permissionLevel" = 'manager' WHERE "permissionLevel" = 'admin';

-- Deactivate the 'common' project
UPDATE "master_projects" SET "is_active" = false WHERE "code" = 'common';
