// ユーザータイプ
export type UserType = "staff" | "external" | "bbs" | "vendor" | "lender";

// 組織ロール
export type OrganizationRole = "member" | "founder";

// 社内スタッフ用セッション
export interface SessionUser {
  id: number;
  loginId: string | null;
  name: string;
  email: string | null;
  userType: UserType;
  permissions: UserPermission[];
  canEditMasterData: boolean;
  organizationRole: OrganizationRole;
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
  canApprove: boolean;
}

export type PermissionLevel = "none" | "view" | "edit" | "manager";

export const PROJECT_CODES = {
  STELLA: "stella",
  STP: "stp",
  SRD: "srd",
  SLP: "slp",
  ACCOUNTING: "accounting",
  HOJO: "hojo",
} as const;

export type ProjectCode = (typeof PROJECT_CODES)[keyof typeof PROJECT_CODES];

// 外部ユーザーステータス
export type ExternalUserStatus =
  | "pending_email"
  | "pending_approval"
  | "active"
  | "suspended";
