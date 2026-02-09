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

  // コードは自動生成（内部識別子として使用、変更不可）
  const code = `proj_${Date.now()}`;

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
  const stellaAdmins = await prisma.staffPermission.findMany({
    where: { projectCode: "stella", permissionLevel: "admin" },
    select: { staffId: true },
  });

  if (stellaAdmins.length > 0) {
    await prisma.staffPermission.createMany({
      data: stellaAdmins.map((sa) => ({
        staffId: sa.staffId,
        projectCode: newProject.code,
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
  await prisma.masterProject.update({
    where: { id },
    data: {
      // code は変更不可（StaffPermission等が文字列で参照しているため）
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
