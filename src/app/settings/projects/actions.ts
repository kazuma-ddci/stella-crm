"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireMasterDataEditPermission } from "@/lib/auth/master-data-permission";

export async function updateProject(id: number, data: Record<string, unknown>) {
  await requireMasterDataEditPermission();
  // code は変更不可（コード側でロジック分岐に使用するため）
  const updateData: Record<string, unknown> = {};
  if ("name" in data) updateData.name = data.name as string;
  if ("description" in data) updateData.description = (data.description as string) || null;
  if ("isActive" in data) updateData.isActive = data.isActive === true || data.isActive === "true";
  if ("operatingCompanyId" in data) updateData.operatingCompanyId = data.operatingCompanyId ? Number(data.operatingCompanyId) : null;

  if (Object.keys(updateData).length > 0) {
    await prisma.masterProject.update({
      where: { id },
      data: updateData,
    });
  }

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
