"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireMasterDataEditPermission } from "@/lib/auth/master-data-permission";

export async function updateDisplayView(id: number, data: Record<string, unknown>) {
  await requireMasterDataEditPermission();
  // viewKey は変更不可（コード側でロジック分岐に使用するため）
  const updateData: Record<string, unknown> = {};
  if ("viewName" in data) updateData.viewName = data.viewName as string;
  if ("projectId" in data) updateData.projectId = Number(data.projectId);
  if ("description" in data) updateData.description = (data.description as string) || null;
  if ("isActive" in data) updateData.isActive = data.isActive === true || data.isActive === "true";

  if (Object.keys(updateData).length > 0) {
    await prisma.displayView.update({
      where: { id },
      data: updateData,
    });
  }
  revalidatePath("/settings/display-views");
}
