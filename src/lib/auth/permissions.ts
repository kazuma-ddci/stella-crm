import type { UserPermission, PermissionLevel, ProjectCode } from "@/types/auth";

const PERMISSION_LEVELS: Record<PermissionLevel, number> = {
  none: 0,
  view: 1,
  edit: 2,
  admin: 3,
};

export function hasPermission(
  permissions: UserPermission[],
  projectCode: ProjectCode,
  requiredLevel: PermissionLevel
): boolean {
  const permission = permissions.find((p) => p.projectCode === projectCode);
  if (!permission) {
    return false;
  }

  const userLevel = PERMISSION_LEVELS[permission.permissionLevel];
  const required = PERMISSION_LEVELS[requiredLevel];

  return userLevel >= required;
}

export function canView(
  permissions: UserPermission[],
  projectCode: ProjectCode
): boolean {
  return hasPermission(permissions, projectCode, "view");
}

export function canEdit(
  permissions: UserPermission[],
  projectCode: ProjectCode
): boolean {
  return hasPermission(permissions, projectCode, "edit");
}

export function isAdmin(
  permissions: UserPermission[],
  projectCode: ProjectCode
): boolean {
  return hasPermission(permissions, projectCode, "admin");
}

export function getPermissionLevel(
  permissions: UserPermission[],
  projectCode: ProjectCode
): PermissionLevel {
  const permission = permissions.find((p) => p.projectCode === projectCode);
  return permission?.permissionLevel ?? "none";
}
