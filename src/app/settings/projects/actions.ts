"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireMasterDataEditPermission } from "@/lib/auth/master-data-permission";

export async function updateProject(id: number, data: Record<string, unknown>) {
  await requireMasterDataEditPermission();
  // code は変更不可（コード側でロジック分岐に使用するため）

  await prisma.masterProject.update({
    where: { id },
    data: {
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
