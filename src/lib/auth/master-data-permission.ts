/**
 * セッションユーザーがadmin権限を持つかチェック（いずれかのプロジェクトでadmin）
 */
function hasAdminPermission(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  user: any
): boolean {
  const permissions = user?.permissions ?? [];
  return permissions.some(
    (p: { permissionLevel: string }) => p.permissionLevel === "admin"
  );
}

/**
 * セッションユーザーが固定データを編集できるかチェック（同期版 - ページコンポーネント用）
 * canEditMasterDataフラグ または admin権限を持つユーザーがtrue
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function canEditMasterDataSync(user: any): boolean {
  return user?.canEditMasterData === true || hasAdminPermission(user);
}

export async function checkMasterDataEditPermission(): Promise<boolean> {
  const { auth } = await import("@/auth");
  const session = await auth();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const user = session?.user as any;
  // canEditMasterDataフラグ または admin権限を持つユーザーは固定データ編集可能
  return user?.canEditMasterData === true || hasAdminPermission(user);
}

export async function requireMasterDataEditPermission(): Promise<void> {
  const canEdit = await checkMasterDataEditPermission();
  if (!canEdit) {
    throw new Error("固定データの編集権限がありません");
  }
}
