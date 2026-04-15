"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireProjectMasterDataEditPermission } from "@/lib/auth/master-data-permission";
import { toBoolean } from "@/lib/utils";

/**
 * 顧客種別の表示名と有効/無効を更新する。
 * コードはシステムで管理されているため変更不可。
 * 新規追加・削除はできない（コードベースで定義）。
 */
export async function updateCustomerType(id: number, data: Record<string, unknown>) {
  await requireProjectMasterDataEditPermission();
  const updateData: Record<string, unknown> = {};
  if ("name" in data) updateData.name = data.name as string;
  if ("isActive" in data) updateData.isActive = toBoolean(data.isActive);

  if (Object.keys(updateData).length > 0) {
    await prisma.customerType.update({
      where: { id },
      data: updateData,
    });
  }
  revalidatePath("/settings/customer-types");
}

export async function reorderCustomerTypes(orderedIds: number[]) {
  await requireProjectMasterDataEditPermission();
  // グループごとに表示順を更新
  // orderedIdsは既にグループ内でソートされている前提

  // まず全ての顧客種別を取得してプロジェクト別にグループ化
  const customerTypes = await prisma.customerType.findMany({
    where: { id: { in: orderedIds } },
    select: { id: true, projectId: true },
  });

  const idToProjectId = new Map(customerTypes.map((ct) => [ct.id, ct.projectId]));

  // プロジェクトごとにカウンターを管理
  const projectCounters = new Map<number, number>();

  await prisma.$transaction(
    orderedIds.map((id) => {
      const projectId = idToProjectId.get(id)!;
      const currentOrder = (projectCounters.get(projectId) ?? 0) + 1;
      projectCounters.set(projectId, currentOrder);

      return prisma.customerType.update({
        where: { id },
        data: { displayOrder: currentOrder },
      });
    })
  );

  revalidatePath("/settings/customer-types");
}
