"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireMasterDataEditPermission } from "@/lib/auth/master-data-permission";

export async function addContactCategory(data: Record<string, unknown>) {
  await requireMasterDataEditPermission();
  const projectId = Number(data.projectId);

  // 同プロジェクト内の最大表示順を取得して+1
  const maxOrder = await prisma.contactCategory.aggregate({
    where: { projectId },
    _max: { displayOrder: true },
  });
  const displayOrder = (maxOrder._max.displayOrder ?? 0) + 1;

  await prisma.contactCategory.create({
    data: {
      projectId,
      name: data.name as string,
      displayOrder,
      isActive: data.isActive === true || data.isActive === "true",
    },
  });
  revalidatePath("/settings/contact-categories");
}

export async function updateContactCategory(id: number, data: Record<string, unknown>) {
  await requireMasterDataEditPermission();
  const updateData: Record<string, unknown> = {};
  if ("projectId" in data) updateData.projectId = Number(data.projectId);
  if ("name" in data) updateData.name = data.name as string;
  if ("isActive" in data) updateData.isActive = data.isActive === true || data.isActive === "true";

  if (Object.keys(updateData).length > 0) {
    await prisma.contactCategory.update({
      where: { id },
      data: updateData,
    });
  }
  revalidatePath("/settings/contact-categories");
}

export async function deleteContactCategory(id: number) {
  await requireMasterDataEditPermission();

  // 接触履歴で使用中の場合はエラー
  const usageCount = await prisma.contactHistory.count({
    where: { contactCategoryId: id },
  });
  if (usageCount > 0) {
    throw new Error(`この接触種別は ${usageCount} 件の接触履歴で使用されているため削除できません`);
  }

  await prisma.contactCategory.delete({
    where: { id },
  });
  revalidatePath("/settings/contact-categories");
}

export async function reorderContactCategories(orderedIds: number[]) {
  await requireMasterDataEditPermission();

  // まず全ての接触種別を取得してプロジェクト別にグループ化
  const contactCategories = await prisma.contactCategory.findMany({
    where: { id: { in: orderedIds } },
    select: { id: true, projectId: true },
  });

  const idToProjectId = new Map(contactCategories.map((cc) => [cc.id, cc.projectId]));

  // プロジェクトごとにカウンターを管理
  const projectCounters = new Map<number, number>();

  await prisma.$transaction(
    orderedIds.map((id) => {
      const projectId = idToProjectId.get(id)!;
      const currentOrder = (projectCounters.get(projectId) ?? 0) + 1;
      projectCounters.set(projectId, currentOrder);

      return prisma.contactCategory.update({
        where: { id },
        data: { displayOrder: currentOrder },
      });
    })
  );

  revalidatePath("/settings/contact-categories");
}
