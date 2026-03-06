/**
 * 共通固定データの編集権限チェック（同期版 - ページコンポーネント用）
 * admin（loginId=admin）+ stella001（canEditMasterData=true）のみ
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function canEditCommonMasterDataSync(user: any): boolean {
  if (!user) return false;
  // loginId === "admin" (システム管理者)
  if (user.loginId === "admin") return true;
  // canEditMasterData === true (stella001)
  return user.canEditMasterData === true;
}

/**
 * PJ固有固定データの編集権限チェック（同期版 - ページコンポーネント用）
 * admin + stella001 + founder + 該当PJのmanager
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function canEditProjectMasterDataSync(user: any, projectCode?: string): boolean {
  if (!user) return false;
  // admin + stella001
  if (canEditCommonMasterDataSync(user)) return true;
  // founder
  if (user.organizationRole === "founder") return true;
  // manager
  const permissions = user?.permissions ?? [];
  if (projectCode) {
    return permissions.some(
      (p: { projectCode: string; permissionLevel: string }) =>
        p.projectCode === projectCode && p.permissionLevel === "manager"
    );
  }
  return permissions.some(
    (p: { permissionLevel: string }) => p.permissionLevel === "manager"
  );
}

/** 後方互換エイリアス */
export const canEditMasterDataSync = canEditCommonMasterDataSync;

/**
 * 共通固定データの編集権限を要求（非同期版 - Server Actions用）
 */
export async function requireCommonMasterDataEditPermission(): Promise<void> {
  const { auth } = await import("@/auth");
  const session = await auth();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const user = session?.user as any;
  if (!canEditCommonMasterDataSync(user)) {
    throw new Error("共通固定データの編集権限がありません");
  }
}

/**
 * PJ固有固定データの編集権限を要求（非同期版 - Server Actions用）
 */
export async function requireProjectMasterDataEditPermission(projectCode?: string): Promise<void> {
  const { auth } = await import("@/auth");
  const session = await auth();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const user = session?.user as any;
  if (!canEditProjectMasterDataSync(user, projectCode)) {
    throw new Error("固定データの編集権限がありません");
  }
}

/** 後方互換エイリアス */
export const requireMasterDataEditPermission = requireCommonMasterDataEditPermission;

/** 後方互換: 旧checkMasterDataEditPermission */
export async function checkMasterDataEditPermission(): Promise<boolean> {
  const { auth } = await import("@/auth");
  const session = await auth();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const user = session?.user as any;
  return canEditCommonMasterDataSync(user);
}
