"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireProjectMasterDataEditPermission } from "@/lib/auth/master-data-permission";

export async function addStatus(data: Record<string, unknown>) {
  await requireProjectMasterDataEditPermission();

  const maxOrder = await prisma.hojoApplicationStatus.aggregate({
    _max: { displayOrder: true },
  });
  const displayOrder = (maxOrder._max.displayOrder ?? 0) + 1;

  await prisma.hojoApplicationStatus.create({
    data: {
      name: String(data.name).trim(),
      displayOrder,
      isActive: data.isActive === true || data.isActive === "true",
    },
  });
  revalidatePath("/hojo/settings/statuses");
}

export async function updateStatus(id: number, data: Record<string, unknown>) {
  await requireProjectMasterDataEditPermission();
  const updateData: Record<string, unknown> = {};
  if ("name" in data) updateData.name = String(data.name).trim();
  if ("isActive" in data) updateData.isActive = data.isActive === true || data.isActive === "true";

  if (Object.keys(updateData).length > 0) {
    await prisma.hojoApplicationStatus.update({
      where: { id },
      data: updateData,
    });
  }
  revalidatePath("/hojo/settings/statuses");
}

export async function deleteStatus(id: number) {
  await requireProjectMasterDataEditPermission();

  const usageCount = await prisma.hojoApplicationSupport.count({
    where: { statusId: id, deletedAt: null },
  });
  if (usageCount > 0) {
    throw new Error(`このステータスは${usageCount}件の申請管理で使用中のため削除できません`);
  }

  await prisma.hojoApplicationStatus.delete({
    where: { id },
  });
  revalidatePath("/hojo/settings/statuses");
}

export async function reorderStatuses(orderedIds: number[]) {
  await requireProjectMasterDataEditPermission();
  await prisma.$transaction(
    orderedIds.map((id, index) =>
      prisma.hojoApplicationStatus.update({
        where: { id },
        data: { displayOrder: index + 1 },
      })
    )
  );
  revalidatePath("/hojo/settings/statuses");
}
