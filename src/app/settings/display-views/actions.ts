"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireMasterDataEditPermission } from "@/lib/auth/master-data-permission";

export async function addDisplayView(data: Record<string, unknown>) {
  await requireMasterDataEditPermission();
  // ビューキーは自動生成（内部識別子として使用、変更不可）
  const viewKey = `view_${Date.now()}`;

  await prisma.displayView.create({
    data: {
      viewKey,
      viewName: data.viewName as string,
      projectId: Number(data.projectId),
      description: (data.description as string) || null,
      isActive: data.isActive === true || data.isActive === "true",
    },
  });
  revalidatePath("/settings/display-views");
}

export async function updateDisplayView(id: number, data: Record<string, unknown>) {
  await requireMasterDataEditPermission();
  await prisma.displayView.update({
    where: { id },
    data: {
      // viewKey は変更不可（外部ユーザー権限等が参照しているため）
      viewName: data.viewName as string,
      projectId: Number(data.projectId),
      description: (data.description as string) || null,
      isActive: data.isActive === true || data.isActive === "true",
    },
  });
  revalidatePath("/settings/display-views");
}

export async function deleteDisplayView(id: number) {
  await requireMasterDataEditPermission();
  await prisma.displayView.update({
    where: { id },
    data: { isActive: false },
  });
  revalidatePath("/settings/display-views");
}
