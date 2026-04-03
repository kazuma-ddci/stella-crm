"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireProjectMasterDataEditPermission } from "@/lib/auth/master-data-permission";
import { toBoolean } from "@/lib/utils";

export async function getAllStatuses() {
  const statuses = await prisma.hojoApplicationStatus.findMany({
    orderBy: { displayOrder: "asc" },
  });
  return statuses.map((s) => ({
    id: s.id,
    name: s.name,
    displayOrder: s.displayOrder,
    isActive: s.isActive,
  }));
}

export async function getStatusUsageCount(id: number): Promise<number> {
  return prisma.hojoApplicationSupport.count({
    where: { statusId: id, deletedAt: null },
  });
}

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
      isActive: toBoolean(data.isActive),
    },
  });
  revalidatePath("/hojo/application-support");
}

export async function updateStatus(id: number, data: Record<string, unknown>) {
  await requireProjectMasterDataEditPermission();
  const updateData: Record<string, unknown> = {};
  if ("name" in data) updateData.name = String(data.name).trim();
  if ("isActive" in data) updateData.isActive = toBoolean(data.isActive);

  if (Object.keys(updateData).length > 0) {
    await prisma.hojoApplicationStatus.update({
      where: { id },
      data: updateData,
    });
  }
  revalidatePath("/hojo/application-support");
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
  revalidatePath("/hojo/application-support");
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
  revalidatePath("/hojo/application-support");
}

// ============================================
// BBSステータス管理
// ============================================

export async function getAllBbsStatuses() {
  const statuses = await prisma.hojoBbsStatus.findMany({
    orderBy: { displayOrder: "asc" },
  });
  return statuses.map((s) => ({
    id: s.id,
    name: s.name,
    displayOrder: s.displayOrder,
    isActive: s.isActive,
  }));
}

export async function addBbsStatus(data: Record<string, unknown>) {
  await requireProjectMasterDataEditPermission();

  const maxOrder = await prisma.hojoBbsStatus.aggregate({
    _max: { displayOrder: true },
  });
  const displayOrder = (maxOrder._max.displayOrder ?? 0) + 1;

  await prisma.hojoBbsStatus.create({
    data: {
      name: String(data.name).trim(),
      displayOrder,
      isActive: toBoolean(data.isActive),
    },
  });
  revalidatePath("/hojo/application-support");
  revalidatePath("/hojo/bbs");
}

export async function updateBbsStatus(id: number, data: Record<string, unknown>) {
  await requireProjectMasterDataEditPermission();
  const updateData: Record<string, unknown> = {};
  if ("name" in data) updateData.name = String(data.name).trim();
  if ("isActive" in data) updateData.isActive = toBoolean(data.isActive);

  if (Object.keys(updateData).length > 0) {
    await prisma.hojoBbsStatus.update({
      where: { id },
      data: updateData,
    });
  }
  revalidatePath("/hojo/application-support");
  revalidatePath("/hojo/bbs");
}

export async function deleteBbsStatus(id: number) {
  await requireProjectMasterDataEditPermission();

  const usageCount = await prisma.hojoApplicationSupport.count({
    where: { bbsStatusId: id, deletedAt: null },
  });
  if (usageCount > 0) {
    throw new Error(`このステータスは${usageCount}件の申請管理で使用中のため削除できません`);
  }

  await prisma.hojoBbsStatus.delete({
    where: { id },
  });
  revalidatePath("/hojo/application-support");
  revalidatePath("/hojo/bbs");
}

export async function reorderBbsStatuses(orderedIds: number[]) {
  await requireProjectMasterDataEditPermission();
  await prisma.$transaction(
    orderedIds.map((id, index) =>
      prisma.hojoBbsStatus.update({
        where: { id },
        data: { displayOrder: index + 1 },
      })
    )
  );
  revalidatePath("/hojo/application-support");
  revalidatePath("/hojo/bbs");
}
