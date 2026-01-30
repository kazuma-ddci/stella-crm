"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

export async function addStage(data: Record<string, unknown>) {
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
  await prisma.stpStage.delete({
    where: { id },
  });
  revalidatePath("/stp/settings/stages");
}
