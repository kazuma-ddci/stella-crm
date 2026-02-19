"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireMasterDataEditPermission } from "@/lib/auth/master-data-permission";

export async function addStage(data: Record<string, unknown>) {
  await requireMasterDataEditPermission();
  await prisma.stpStage.create({
    data: {
      name: data.name as string,
      stageType: (data.stageType as string) || 'progress',
      displayOrder: data.displayOrder != null && data.displayOrder !== "" ? Number(data.displayOrder) : null,
      isActive: data.isActive === true || data.isActive === "true",
    },
  });
  revalidatePath("/stp/settings/stages");
}

export async function updateStage(id: number, data: Record<string, unknown>) {
  await requireMasterDataEditPermission();
  const updateData: Record<string, unknown> = {};
  if ("name" in data) updateData.name = data.name as string;
  if ("stageType" in data) updateData.stageType = data.stageType as string;
  if ("displayOrder" in data) updateData.displayOrder = data.displayOrder != null && data.displayOrder !== "" ? Number(data.displayOrder) : null;
  if ("isActive" in data) updateData.isActive = data.isActive === true || data.isActive === "true";

  if (Object.keys(updateData).length > 0) {
    await prisma.stpStage.update({
      where: { id },
      data: updateData,
    });
  }
  revalidatePath("/stp/settings/stages");
}

export async function deleteStage(id: number) {
  await requireMasterDataEditPermission();
  await prisma.stpStage.delete({
    where: { id },
  });
  revalidatePath("/stp/settings/stages");
}
