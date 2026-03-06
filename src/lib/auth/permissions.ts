import type { UserPermission, PermissionLevel, ProjectCode, SessionUser } from "@/types/auth";

const PERMISSION_LEVELS: Record<string, number> = {
  none: 0,
  view: 1,
  edit: 2,
  manager: 3,
  admin: 3, // 後方互換: 旧JWTセッションに"admin"が残っている場合にmanagerと同等に扱う
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

/** プロジェクトのmanager権限を持つか（旧isAdmin） */
export function isManager(
  permissions: UserPermission[],
  projectCode: ProjectCode
): boolean {
  return hasPermission(permissions, projectCode, "manager");
}

/** 後方互換エイリアス: isAdmin → isManager */
export const isAdmin = isManager;

/** 組織のファウンダーか */
export function isFounder(user: SessionUser): boolean {
  return user.organizationRole === "founder";
}

/** システム管理者か（loginId === "admin"） */
export function isSystemAdmin(user: SessionUser): boolean {
  return user.loginId === "admin";
}

/** 共通固定データを編集できるか（admin + stella001のみ） */
export function canEditCommonMasterData(user: SessionUser): boolean {
  return isSystemAdmin(user) || user.canEditMasterData === true;
}

/** PJ固有固定データを編集できるか（admin + founder + stella001 + manager） */
export function canEditProjectMasterData(
  user: SessionUser,
  projectCode?: ProjectCode
): boolean {
  if (isSystemAdmin(user) || user.canEditMasterData === true) return true;
  if (isFounder(user)) return true;
  if (projectCode) {
    return isManager(user.permissions, projectCode);
  }
  // projectCode未指定: いずれかのPJでmanager
  return user.permissions.some((p) => p.permissionLevel === "manager");
}

export function getPermissionLevel(
  permissions: UserPermission[],
  projectCode: ProjectCode
): PermissionLevel {
  const permission = permissions.find((p) => p.projectCode === projectCode);
  return permission?.permissionLevel ?? "none";
}
