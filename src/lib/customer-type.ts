import { prisma } from "@/lib/prisma";

const cache = new Map<string, number>();

/**
 * 顧客種別コードから顧客種別IDを解決する。
 * 初回アクセス時のみDBを叩き、以降はメモリキャッシュを返す。
 * 顧客種別はコードで不変に管理されているため、プロセス内キャッシュで問題ない。
 */
export async function getCustomerTypeIdByCode(code: string): Promise<number> {
  const cached = cache.get(code);
  if (cached !== undefined) return cached;

  const row = await prisma.customerType.findFirst({
    where: { code },
    select: { id: true },
  });
  if (!row) {
    throw new Error(`顧客種別コード "${code}" が見つかりません`);
  }
  cache.set(code, row.id);
  return row.id;
}

/**
 * コード配列から一括でID配列を解決する。
 */
export async function getCustomerTypeIdsByCodes(
  codes: string[]
): Promise<number[]> {
  return Promise.all(codes.map((c) => getCustomerTypeIdByCode(c)));
}
