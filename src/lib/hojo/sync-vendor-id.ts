import { prisma } from "@/lib/prisma";

/**
 * LINE友達のfree1からvendorIdを解決してHojoApplicationSupportに同期する。
 * 特定のlineFriendIdを指定した場合はそのレコードのみ、省略した場合は全レコードを同期。
 */
export async function syncVendorIdFromFree1(lineFriendId?: number) {
  // 全LINE友達を取得（uid→joseiIdマップ用）
  const allJoseiFriends = await prisma.hojoLineFriendJoseiSupport.findMany({
    where: { deletedAt: null },
    select: { id: true, uid: true, free1: true },
  });

  // ベンダー一覧（joseiLineFriendId → vendorId）
  const vendorsWithJosei = await prisma.hojoVendor.findMany({
    where: { joseiLineFriendId: { not: null } },
    select: { id: true, joseiLineFriendId: true },
  });
  const vendorIdByJoseiId = new Map(
    vendorsWithJosei.filter((v) => v.joseiLineFriendId).map((v) => [v.joseiLineFriendId!, v.id])
  );

  // uid → joseiId マップ
  const joseiByUid = new Map(
    allJoseiFriends.map((f) => [f.uid, f.id])
  );

  function resolveVendorId(free1: string | null): number | null {
    if (!free1) return null;
    const referredId = joseiByUid.get(free1);
    if (referredId === undefined) return null;
    return vendorIdByJoseiId.get(referredId) ?? null;
  }

  // 同期対象のレコードを取得
  const whereClause = lineFriendId
    ? { lineFriendId, deletedAt: null }
    : { deletedAt: null };

  const records = await prisma.hojoApplicationSupport.findMany({
    where: whereClause,
    select: { id: true, lineFriendId: true, vendorId: true },
  });

  // LINE友達のfree1マップ
  const free1ByFriendId = new Map(
    allJoseiFriends.map((f) => [f.id, f.free1])
  );

  // 差分があるレコードのみ更新
  const updates: { id: number; vendorId: number | null }[] = [];
  for (const r of records) {
    const free1 = free1ByFriendId.get(r.lineFriendId) ?? null;
    const correctVendorId = resolveVendorId(free1);
    if (r.vendorId !== correctVendorId) {
      updates.push({ id: r.id, vendorId: correctVendorId });
    }
  }

  if (updates.length > 0) {
    await Promise.all(
      updates.map((u) =>
        prisma.hojoApplicationSupport.update({
          where: { id: u.id },
          data: { vendorId: u.vendorId },
        })
      )
    );
  }

  return updates.length;
}
