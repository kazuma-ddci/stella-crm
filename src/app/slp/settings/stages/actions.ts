"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireProjectMasterDataEditPermission } from "@/lib/auth/master-data-permission";

export async function addSlpStage(data: Record<string, unknown>) {
  await requireProjectMasterDataEditPermission();
  await prisma.slpStage.create({
    data: {
      name: data.name as string,
      stageNumber: Number(data.stageNumber),
      phase: (data.phase as string) || null,
      winRate: data.winRate != null && data.winRate !== "" ? Number(data.winRate) : null,
      autoAction: (data.autoAction as string) || null,
      isActive: data.isActive === true || data.isActive === "true",
    },
  });
  revalidatePath("/slp/settings/stages");
}

export async function updateSlpStage(id: number, data: Record<string, unknown>) {
  await requireProjectMasterDataEditPermission();
  const updateData: Record<string, unknown> = {};
  if ("name" in data) updateData.name = data.name as string;
  if ("stageNumber" in data) updateData.stageNumber = Number(data.stageNumber);
  if ("phase" in data) updateData.phase = (data.phase as string) || null;
  if ("winRate" in data) updateData.winRate = data.winRate != null && data.winRate !== "" ? Number(data.winRate) : null;
  if ("autoAction" in data) updateData.autoAction = (data.autoAction as string) || null;
  if ("isActive" in data) updateData.isActive = data.isActive === true || data.isActive === "true";

  if (Object.keys(updateData).length > 0) {
    await prisma.slpStage.update({
      where: { id },
      data: updateData,
    });
  }
  revalidatePath("/slp/settings/stages");
}

export async function deleteSlpStage(id: number) {
  await requireProjectMasterDataEditPermission();
  await prisma.slpStage.delete({
    where: { id },
  });
  revalidatePath("/slp/settings/stages");
}
