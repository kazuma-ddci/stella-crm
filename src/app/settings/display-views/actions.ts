"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireProjectMasterDataEditPermission } from "@/lib/auth/master-data-permission";
import { toBoolean } from "@/lib/utils";

export async function updateDisplayView(id: number, data: Record<string, unknown>) {
  await requireProjectMasterDataEditPermission();
  // viewKey は変更不可（コード側でロジック分岐に使用するため）
  const updateData: Record<string, unknown> = {};
  if ("viewName" in data) updateData.viewName = data.viewName as string;
  if ("projectId" in data) updateData.projectId = Number(data.projectId);
  if ("description" in data) updateData.description = (data.description as string) || null;
  if ("isActive" in data) updateData.isActive = toBoolean(data.isActive);

  if (Object.keys(updateData).length > 0) {
    await prisma.displayView.update({
      where: { id },
      data: updateData,
    });
  }
  revalidatePath("/settings/display-views");
}
