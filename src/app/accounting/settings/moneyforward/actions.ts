"use server";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { getAuthorizationUrl } from "@/lib/moneyforward/client";
import { revalidatePath } from "next/cache";

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
): Promise<string> {
  await getSession();

  const state = JSON.stringify({ operatingCompanyId });
  return getAuthorizationUrl(state);
}

/** 接続を無効化（論理削除） */
export async function disconnectConnection(
  connectionId: number
): Promise<void> {
  await getSession();

  await prisma.moneyForwardConnection.update({
    where: { id: connectionId },
    data: { isActive: false },
  });

  revalidatePath("/accounting/settings/moneyforward");
}

/** 同期開始日を更新 */
export async function updateSyncFromDate(
  connectionId: number,
  date: string
): Promise<void> {
  await getSession();

  await prisma.moneyForwardConnection.update({
    where: { id: connectionId },
    data: { syncFromDate: new Date(date) },
  });

  revalidatePath("/accounting/settings/moneyforward");
}
