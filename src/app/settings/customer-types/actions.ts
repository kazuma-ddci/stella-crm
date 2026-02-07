"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireMasterDataEditPermission } from "@/lib/auth/master-data-permission";

export async function addCustomerType(data: Record<string, unknown>) {
  await requireMasterDataEditPermission();
  const projectId = Number(data.projectId);

  // 同プロジェクト内の最大表示順を取得して+1
  const maxOrder = await prisma.customerType.aggregate({
    where: { projectId },
    _max: { displayOrder: true },
  });
  const displayOrder = (maxOrder._max.displayOrder ?? 0) + 1;

  await prisma.customerType.create({
    data: {
      projectId,
      name: data.name as string,
      displayOrder,
      isActive: data.isActive === true || data.isActive === "true",
    },
  });
  revalidatePath("/settings/customer-types");
}

export async function updateCustomerType(id: number, data: Record<string, unknown>) {
  await requireMasterDataEditPermission();
  await prisma.customerType.update({
    where: { id },
    data: {
      projectId: Number(data.projectId),
      name: data.name as string,
      isActive: data.isActive === true || data.isActive === "true",
    },
  });
  revalidatePath("/settings/customer-types");
}

export async function deleteCustomerType(id: number) {
  await requireMasterDataEditPermission();
  await prisma.customerType.delete({
    where: { id },
  });
  revalidatePath("/settings/customer-types");
}

export async function reorderCustomerTypes(orderedIds: number[]) {
  await requireMasterDataEditPermission();
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
