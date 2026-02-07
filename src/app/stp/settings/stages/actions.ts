"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireMasterDataEditPermission } from "@/lib/auth/master-data-permission";

export async function addStage(data: Record<string, unknown>) {
  await requireMasterDataEditPermission();
  await prisma.stpStage.create({
    data: {
      name: data.name as string,
      displayOrder: data.displayOrder ? Number(data.displayOrder) : 0,
      isActive: data.isActive === true || data.isActive === "true",
    },
  });
  revalidatePath("/stp/settings/stages");
}

export async function updateStage(id: number, data: Record<string, unknown>) {
  await requireMasterDataEditPermission();
  await prisma.stpStage.update({
    where: { id },
    data: {
      name: data.name as string,
      displayOrder: data.displayOrder ? Number(data.displayOrder) : 0,
      isActive: data.isActive === true || data.isActive === "true",
    },
  });
  revalidatePath("/stp/settings/stages");
}

export async function deleteStage(id: number) {
  await requireMasterDataEditPermission();
  await prisma.stpStage.delete({
    where: { id },
  });
  revalidatePath("/stp/settings/stages");
}
