"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireMasterDataEditPermission } from "@/lib/auth/master-data-permission";

export async function addProject(data: Record<string, unknown>) {
  await requireMasterDataEditPermission();
  // 最大の表示順を取得して+1
  const maxOrder = await prisma.masterProject.aggregate({
    _max: { displayOrder: true },
  });
  const displayOrder = (maxOrder._max.displayOrder ?? 0) + 1;

  const code = (data.code as string).toLowerCase();

  const newProject = await prisma.masterProject.create({
    data: {
      code,
      name: data.name as string,
      description: (data.description as string) || null,
      displayOrder,
      isActive: data.isActive === true || data.isActive === "true",
      operatingCompanyId: data.operatingCompanyId
        ? Number(data.operatingCompanyId)
        : null,
    },
  });

  // Stella管理者権限を持つスタッフに新プロジェクトのadmin権限を自動付与
  const stellaProject = await prisma.masterProject.findUnique({ where: { code: "stella" } });
  const stellaAdmins = stellaProject
    ? await prisma.staffPermission.findMany({
        where: { projectId: stellaProject.id, permissionLevel: "admin" },
        select: { staffId: true },
      })
    : [];

  if (stellaAdmins.length > 0) {
    await prisma.staffPermission.createMany({
      data: stellaAdmins.map((sa) => ({
        staffId: sa.staffId,
        projectId: newProject.id,
        permissionLevel: "admin",
      })),
      skipDuplicates: true,
    });
  }

  revalidatePath("/settings/projects");
  revalidatePath("/staff");
}

export async function updateProject(id: number, data: Record<string, unknown>) {
  await requireMasterDataEditPermission();
  const newCode = (data.code as string).toLowerCase();

  await prisma.masterProject.update({
    where: { id },
    data: {
      code: newCode,
      name: data.name as string,
      description: (data.description as string) || null,
      isActive: data.isActive === true || data.isActive === "true",
      operatingCompanyId: data.operatingCompanyId
        ? Number(data.operatingCompanyId)
        : null,
    },
  });

  revalidatePath("/settings/projects");
}

export async function deleteProject(id: number) {
  await requireMasterDataEditPermission();
  // 論理削除（関連データが多いため物理削除は行わない）
  await prisma.masterProject.update({
    where: { id },
    data: { isActive: false },
  });
  revalidatePath("/settings/projects");
}

export async function reorderProjects(orderedIds: number[]) {
  await requireMasterDataEditPermission();
  // トランザクションで一括更新
  await prisma.$transaction(
    orderedIds.map((id, index) =>
      prisma.masterProject.update({
        where: { id },
        data: { displayOrder: index + 1 },
      })
    )
  );
  revalidatePath("/settings/projects");
}
