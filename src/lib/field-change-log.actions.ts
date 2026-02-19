"use server";

/**
 * フィールド変更履歴 - Server Actions（クライアントから呼び出し可能）
 * "use client" コンポーネントからはこのファイルをimportする
 * Prisma依存だがファイルレベル "use server" でクライアントバンドルに含まれない
 */

import { prisma } from "@/lib/prisma";

/**
 * 特定エンティティのフィールド変更履歴を取得
 * クライアントコンポーネントから呼び出し可能
 */
export async function getFieldChangeLogs(
  entityType: string,
  entityId: number,
) {
  return prisma.fieldChangeLog.findMany({
    where: { entityType, entityId },
    orderBy: { createdAt: "desc" },
  });
}
