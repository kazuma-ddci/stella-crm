"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireProjectMasterDataEditPermission } from "@/lib/auth/master-data-permission";

export async function addContractType(data: Record<string, unknown>) {
  await requireProjectMasterDataEditPermission();
  const projectId = Number(data.projectId);

  // 同プロジェクト内の最大表示順を取得して+1
  const maxOrder = await prisma.contractType.aggregate({
    where: { projectId },
    _max: { displayOrder: true },
  });
  const displayOrder = (maxOrder._max.displayOrder ?? 0) + 1;

  await prisma.contractType.create({
    data: {
      projectId,
      name: data.name as string,
      description: (data.description as string) || null,
      displayOrder,
      isActive: data.isActive === true || data.isActive === "true",
    },
  });
  revalidatePath("/settings/contract-types");
}

export async function updateContractType(id: number, data: Record<string, unknown>) {
  await requireProjectMasterDataEditPermission();
  const updateData: Record<string, unknown> = {};
  if ("projectId" in data) updateData.projectId = Number(data.projectId);
  if ("name" in data) updateData.name = data.name as string;
  if ("description" in data) updateData.description = (data.description as string) || null;
  if ("isActive" in data) updateData.isActive = data.isActive === true || data.isActive === "true";

  if (Object.keys(updateData).length > 0) {
    await prisma.contractType.update({
      where: { id },
      data: updateData,
    });
  }
  revalidatePath("/settings/contract-types");
}

export async function deleteContractType(id: number) {
  await requireProjectMasterDataEditPermission();
  await prisma.contractType.delete({
    where: { id },
  });
  revalidatePath("/settings/contract-types");
}

export async function reorderContractTypes(orderedIds: number[]) {
  await requireProjectMasterDataEditPermission();

  const contractTypes = await prisma.contractType.findMany({
    where: { id: { in: orderedIds } },
    select: { id: true, projectId: true },
  });

  const idToProjectId = new Map(contractTypes.map((ct) => [ct.id, ct.projectId]));

  // プロジェクトごとにカウンターを管理
  const projectCounters = new Map<number, number>();

  await prisma.$transaction(
    orderedIds.map((id) => {
      const projectId = idToProjectId.get(id)!;
      const currentOrder = (projectCounters.get(projectId) ?? 0) + 1;
      projectCounters.set(projectId, currentOrder);

      return prisma.contractType.update({
        where: { id },
        data: { displayOrder: currentOrder },
      });
    })
  );

  revalidatePath("/settings/contract-types");
}
