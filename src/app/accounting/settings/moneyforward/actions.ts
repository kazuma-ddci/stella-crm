"use server";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { getAuthorizationUrl } from "@/lib/moneyforward/client";
import { revalidatePath } from "next/cache";
import { ok, err, type ActionResult } from "@/lib/action-result";

export type MFConnectionRow = {
  id: number;
  operatingCompany: { id: number; companyName: string };
  lastSyncedAt: Date | null;
  syncFromDate: Date | null;
  isActive: boolean;
  createdAt: Date;
};

/** 全てのMF接続一覧を取得（法人名付き） */
export async function getMoneyForwardConnections(): Promise<MFConnectionRow[]> {
  await getSession();

  const connections = await prisma.moneyForwardConnection.findMany({
    where: { isActive: true },
    select: {
      id: true,
      operatingCompany: {
        select: { id: true, companyName: true },
      },
      lastSyncedAt: true,
      syncFromDate: true,
      isActive: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return connections;
}

/** 有効な法人一覧を取得 */
export async function getOperatingCompanies(): Promise<
  { id: number; companyName: string }[]
> {
  await getSession();

  return prisma.operatingCompany.findMany({
    where: { isActive: true },
    select: { id: true, companyName: true },
    orderBy: { id: "asc" },
  });
}

/** OAuth認可フローを開始（認可URLを返す） */
export async function startOAuthFlow(
  operatingCompanyId: number
): Promise<ActionResult<{ authorizationUrl: string }>> {
  // 注: getSession() は未認証時に redirect("/login") を throw するため、
  // try/catch の外に置いて Next.js に伝播させる（catch すると redirect が消える）
  await getSession();
  try {
    const state = JSON.stringify({ operatingCompanyId });
    const authorizationUrl = getAuthorizationUrl(state);
    return ok({ authorizationUrl });
  } catch (e) {
    console.error("[startOAuthFlow] error:", e);
    return err(
      e instanceof Error ? e.message : "認可URLの生成に失敗しました"
    );
  }
}

/** 接続を無効化（論理削除） */
export async function disconnectConnection(
  connectionId: number
): Promise<ActionResult<void>> {
  // 注: getSession() の redirect を伝播させるため try/catch の外で呼ぶ
  await getSession();
  try {
    await prisma.moneyForwardConnection.update({
      where: { id: connectionId },
      data: { isActive: false },
    });

    revalidatePath("/accounting/settings/moneyforward");
    return ok();
  } catch (e) {
    console.error("[disconnectConnection] error:", e);
    return err(
      e instanceof Error ? e.message : "接続解除に失敗しました"
    );
  }
}

/** 同期開始日を更新 */
export async function updateSyncFromDate(
  connectionId: number,
  date: string
): Promise<ActionResult<void>> {
  // 注: getSession() の redirect を伝播させるため try/catch の外で呼ぶ
  await getSession();
  try {
    await prisma.moneyForwardConnection.update({
      where: { id: connectionId },
      data: { syncFromDate: new Date(date) },
    });

    revalidatePath("/accounting/settings/moneyforward");
    return ok();
  } catch (e) {
    console.error("[updateSyncFromDate] error:", e);
    return err(
      e instanceof Error ? e.message : "同期開始日の更新に失敗しました"
    );
  }
}
