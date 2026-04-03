"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireProjectMasterDataEditPermission } from "@/lib/auth/master-data-permission";
import { toBoolean } from "@/lib/utils";

export async function addRoleType(data: Record<string, unknown>) {
  await requireProjectMasterDataEditPermission();
  // 最大の表示順を取得して+1
  const maxOrder = await prisma.staffRoleType.aggregate({
    _max: { displayOrder: true },
  });
  const displayOrder = (maxOrder._max.displayOrder ?? 0) + 1;

  // codeは自動生成（ROLE-連番）
  const maxId = await prisma.staffRoleType.aggregate({
    _max: { id: true },
  });
  const nextNum = (maxId._max.id ?? 0) + 1;
  const code = `ROLE-${String(nextNum).padStart(3, "0")}`;

  const projectIds = Array.isArray(data.projectIds)
    ? (data.projectIds as string[]).map(Number).filter((n) => !isNaN(n))
    : [];

  await prisma.staffRoleType.create({
    data: {
      code,
      name: data.name as string,
      description: (data.description as string) || null,
      displayOrder,
      isActive: toBoolean(data.isActive),
      projectLinks: projectIds.length > 0
        ? { createMany: { data: projectIds.map((projectId) => ({ projectId })) } }
        : undefined,
    },
  });
  revalidatePath("/staff/role-types");
  revalidatePath("/staff");
}

export async function updateRoleType(id: number, data: Record<string, unknown>) {
  await requireProjectMasterDataEditPermission();
  const updateData: Record<string, unknown> = {};
  if ("name" in data) updateData.name = data.name as string;
  if ("description" in data) updateData.description = (data.description as string) || null;
  if ("isActive" in data) updateData.isActive = toBoolean(data.isActive);

  if (Object.keys(updateData).length > 0) {
    await prisma.staffRoleType.update({
      where: { id },
      data: updateData,
    });
  }

  // プロジェクト紐付けの更新
  if ("projectIds" in data) {
    const projectIds = Array.isArray(data.projectIds)
      ? (data.projectIds as string[]).map(Number).filter((n) => !isNaN(n))
      : [];

    // 既存を削除して再作成
    await prisma.staffRoleTypeProject.deleteMany({
      where: { roleTypeId: id },
    });
    if (projectIds.length > 0) {
      await prisma.staffRoleTypeProject.createMany({
        data: projectIds.map((projectId) => ({ roleTypeId: id, projectId })),
      });
    }
  }

  revalidatePath("/staff/role-types");
  revalidatePath("/staff");
}

export async function deleteRoleType(id: number) {
  await requireProjectMasterDataEditPermission();
  await prisma.staffRoleType.delete({
    where: { id },
  });
  revalidatePath("/staff/role-types");
  revalidatePath("/staff");
}

export async function reorderRoleTypes(orderedIds: number[]) {
  await requireProjectMasterDataEditPermission();
  await prisma.$transaction(
    orderedIds.map((id, index) =>
      prisma.staffRoleType.update({
        where: { id },
        data: { displayOrder: index + 1 },
      })
    )
  );
  revalidatePath("/staff/role-types");
  revalidatePath("/staff");
}
