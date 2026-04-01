import { prisma } from "@/lib/prisma";

export type VendorMismatch = {
  applicationSupportId: number;
  lineFriendId: number;
  currentVendorId: number | null;
  currentVendorName: string | null;
  resolvedVendorId: number | null;
  resolvedVendorName: string | null;
  vendorIdManual: boolean;
};

/**
 * LINE友達のfree1からvendorIdを解決してHojoApplicationSupportに同期する。
 * - vendorIdManual=false かつ vendorId=null のレコードのみ自動設定（初回のみ）
 * - vendorIdManual=true のレコードは変更しない
 * - free1から解決したベンダーと現在のベンダーが異なるレコードの不一致情報を返す
 */
export async function syncVendorIdFromFree1(lineFriendId?: number): Promise<{
  updatedCount: number;
  mismatches: VendorMismatch[];
}> {
  const allJoseiFriends = await prisma.hojoLineFriendJoseiSupport.findMany({
    where: { deletedAt: null },
    select: { id: true, uid: true, free1: true },
  });

  // ベンダー一覧（旧フィールド + contacts両方からjoseiLineFriendId→vendorマップを構築）
  const vendorsWithJosei = await prisma.hojoVendor.findMany({
    where: { isActive: true },
    select: { id: true, name: true, joseiLineFriendId: true, contacts: { select: { joseiLineFriendId: true } } },
  });
  const vendorByJoseiId = new Map<number, { id: number; name: string }>();
  for (const v of vendorsWithJosei) {
    if (v.joseiLineFriendId) {
      vendorByJoseiId.set(v.joseiLineFriendId, { id: v.id, name: v.name });
    }
    for (const c of v.contacts) {
      if (c.joseiLineFriendId) {
        vendorByJoseiId.set(c.joseiLineFriendId, { id: v.id, name: v.name });
      }
    }
  }

  const joseiByUid = new Map(
    allJoseiFriends.map((f) => [f.uid, f.id])
  );

  function resolveVendor(free1: string | null): { id: number; name: string } | null {
    if (!free1) return null;
    const referredId = joseiByUid.get(free1);
    if (referredId === undefined) return null;
    return vendorByJoseiId.get(referredId) ?? null;
  }

  const whereClause = lineFriendId
    ? { lineFriendId, deletedAt: null }
    : { deletedAt: null };

  const records = await prisma.hojoApplicationSupport.findMany({
    where: whereClause,
    include: { vendor: { select: { name: true } } },
  });

  const free1ByFriendId = new Map(
    allJoseiFriends.map((f) => [f.id, f.free1])
  );

  const updates: { id: number; vendorId: number | null }[] = [];
  const mismatches: VendorMismatch[] = [];

  for (const r of records) {
    const free1 = free1ByFriendId.get(r.lineFriendId) ?? null;
    const resolved = resolveVendor(free1);
    const resolvedVendorId = resolved?.id ?? null;

    // vendorIdManual=false かつ vendorId=null → 初回自動設定
    if (!r.vendorIdManual && r.vendorId === null && resolvedVendorId !== null) {
      updates.push({ id: r.id, vendorId: resolvedVendorId });
    }

    // 不一致検出（現在のベンダーとfree1から解決したベンダーが異なる）
    if (r.vendorId !== resolvedVendorId) {
      mismatches.push({
        applicationSupportId: r.id,
        lineFriendId: r.lineFriendId,
        currentVendorId: r.vendorId,
        currentVendorName: r.vendor?.name ?? null,
        resolvedVendorId,
        resolvedVendorName: resolved?.name ?? null,
        vendorIdManual: r.vendorIdManual,
      });
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

  return { updatedCount: updates.length, mismatches };
}
