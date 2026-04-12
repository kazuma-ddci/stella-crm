"use server";

/**
 * フィールド変更履歴 - Server Actions（クライアントから呼び出し可能）
 * "use client" コンポーネントからはこのファイルをimportする
 * Prisma依存だがファイルレベル "use server" でクライアントバンドルに含まれない
 */

import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/auth/staff-action";

/**
 * 特定エンティティのフィールド変更履歴を取得
 * クライアントコンポーネントから呼び出し可能
 *
 * 認証: 社内スタッフのみ。変更履歴はプロジェクトを跨いで使われる(契約書/STP/SLP等)ので
 * 個別 project 権限ではなく staff 全体で許可。
 * 注: getSession() の redirect を伝播させるため try/catch の外で呼ぶ。
 */
export async function getFieldChangeLogs(
  entityType: string,
  entityId: number,
) {
  await requireStaff();
  return prisma.fieldChangeLog.findMany({
    where: { entityType, entityId },
    orderBy: { createdAt: "desc" },
  });
}
