// ユーザータイプ
export type UserType = "staff" | "external";

// 社内スタッフ用セッション
export interface SessionUser {
  id: number;
  name: string;
  email: string | null;
  userType: UserType;
  permissions: UserPermission[];
}

// 外部ユーザー用セッション情報
export interface ExternalSessionUser {
  id: number;
  name: string;
  email: string;
  userType: "external";
  companyId: number;
  companyName: string;
  displayViews: DisplayViewPermission[];
}

export interface DisplayViewPermission {
  viewKey: string;
  viewName: string;
  projectCode: string;
}

export interface UserPermission {
  projectCode: string;
  permissionLevel: PermissionLevel;
}

export type PermissionLevel = "none" | "view" | "edit" | "admin";

export const PROJECT_CODES = {
  STELLA: "stella",
  STP: "stp",
} as const;

export type ProjectCode = (typeof PROJECT_CODES)[keyof typeof PROJECT_CODES];

// 外部ユーザーステータス
export type ExternalUserStatus =
  | "pending_email"
  | "pending_approval"
  | "active"
  | "suspended";
