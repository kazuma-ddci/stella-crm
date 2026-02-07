"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireMasterDataEditPermission } from "@/lib/auth/master-data-permission";

export async function addDisplayView(data: Record<string, unknown>) {
  await requireMasterDataEditPermission();
  await prisma.displayView.create({
    data: {
      viewKey: data.viewKey as string,
      viewName: data.viewName as string,
      projectCode: data.projectCode as string,
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
      viewKey: data.viewKey as string,
      viewName: data.viewName as string,
      projectCode: data.projectCode as string,
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
