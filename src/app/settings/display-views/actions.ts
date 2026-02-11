"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireMasterDataEditPermission } from "@/lib/auth/master-data-permission";

export async function updateDisplayView(id: number, data: Record<string, unknown>) {
  await requireMasterDataEditPermission();
  await prisma.displayView.update({
    where: { id },
    data: {
      // viewKey は変更不可（コード側でロジック分岐に使用するため）
      viewName: data.viewName as string,
      projectId: Number(data.projectId),
      description: (data.description as string) || null,
      isActive: data.isActive === true || data.isActive === "true",
    },
  });
  revalidatePath("/settings/display-views");
}
