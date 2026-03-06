"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireMasterDataEditPermission } from "@/lib/auth/master-data-permission";

export async function updateFieldDefinitionProjects(
  fieldDefinitionId: number,
  projectIds: number[],
) {
  await requireMasterDataEditPermission();

  // 既存リンクを全削除して再作成
  await prisma.$transaction([
    prisma.staffFieldDefinitionProject.deleteMany({
      where: { fieldDefinitionId },
    }),
    ...(projectIds.length > 0
      ? [
          prisma.staffFieldDefinitionProject.createMany({
            data: projectIds.map((projectId) => ({
              fieldDefinitionId,
              projectId,
            })),
          }),
        ]
      : []),
  ]);

  revalidatePath("/staff/field-definitions");
}
