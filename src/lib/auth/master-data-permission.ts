export async function checkMasterDataEditPermission(): Promise<boolean> {
  const { auth } = await import("@/auth");
  const session = await auth();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (session?.user as any)?.canEditMasterData === true;
}

export async function requireMasterDataEditPermission(): Promise<void> {
  const canEdit = await checkMasterDataEditPermission();
  if (!canEdit) {
    throw new Error("固定データの編集権限がありません");
  }
}
