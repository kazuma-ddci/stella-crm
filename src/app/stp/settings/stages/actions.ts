"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireProjectMasterDataEditPermission } from "@/lib/auth/master-data-permission";
import { toBoolean } from "@/lib/utils";

export async function addStage(data: Record<string, unknown>) {
  await requireProjectMasterDataEditPermission("stp");
  await prisma.stpStage.create({
    data: {
      name: data.name as string,
      stageType: (data.stageType as string) || 'progress',
      displayOrder: data.displayOrder != null && data.displayOrder !== "" ? Number(data.displayOrder) : null,
      isActive: toBoolean(data.isActive),
    },
  });
  revalidatePath("/stp/settings/stages");
}

export async function updateStage(id: number, data: Record<string, unknown>) {
  await requireProjectMasterDataEditPermission("stp");
  const updateData: Record<string, unknown> = {};
  if ("name" in data) updateData.name = data.name as string;
  if ("stageType" in data) updateData.stageType = data.stageType as string;
  if ("displayOrder" in data) updateData.displayOrder = data.displayOrder != null && data.displayOrder !== "" ? Number(data.displayOrder) : null;
  if ("isActive" in data) updateData.isActive = toBoolean(data.isActive);

  if (Object.keys(updateData).length > 0) {
    await prisma.stpStage.update({
      where: { id },
      data: updateData,
    });
  }
  revalidatePath("/stp/settings/stages");
}

export async function deleteStage(id: number) {
  await requireProjectMasterDataEditPermission("stp");
  await prisma.stpStage.delete({
    where: { id },
  });
  revalidatePath("/stp/settings/stages");
}

export async function addLostReasonOption(data: Record<string, unknown>) {
  await requireProjectMasterDataEditPermission("stp");
  const name = String(data.name ?? "").trim();
  if (!name) {
    throw new Error("失注理由を入力してください");
  }

  const maxOrder = await prisma.stpLostReasonOption.aggregate({
    _max: { displayOrder: true },
  });

  await prisma.stpLostReasonOption.create({
    data: {
      name,
      displayOrder: (maxOrder._max.displayOrder ?? 0) + 1,
      isActive: "isActive" in data ? toBoolean(data.isActive) : true,
    },
  });

  revalidatePath("/stp/settings/stages");
}

export async function updateLostReasonOption(id: number, data: Record<string, unknown>) {
  await requireProjectMasterDataEditPermission("stp");

  const updateData: Record<string, unknown> = {};
  if ("name" in data) {
    const name = String(data.name ?? "").trim();
    if (!name) {
      throw new Error("失注理由を入力してください");
    }
    updateData.name = name;
  }
  if ("isActive" in data) updateData.isActive = toBoolean(data.isActive);

  if (Object.keys(updateData).length > 0) {
    await prisma.stpLostReasonOption.update({
      where: { id },
      data: updateData,
    });
  }

  revalidatePath("/stp/settings/stages");
}

export async function deleteLostReasonOption(id: number) {
  await requireProjectMasterDataEditPermission("stp");

  const [companyCount, historyCount] = await Promise.all([
    prisma.stpCompany.count({ where: { lostReasonOptionId: id } }),
    prisma.stpStageHistory.count({ where: { lostReasonOptionId: id } }),
  ]);

  if (companyCount > 0 || historyCount > 0) {
    await prisma.stpLostReasonOption.update({
      where: { id },
      data: { isActive: false },
    });
  } else {
    await prisma.stpLostReasonOption.delete({
      where: { id },
    });
  }

  revalidatePath("/stp/settings/stages");
}

export async function reorderLostReasonOptions(orderedIds: number[]) {
  await requireProjectMasterDataEditPermission("stp");

  await prisma.$transaction(
    orderedIds.map((id, index) =>
      prisma.stpLostReasonOption.update({
        where: { id },
        data: { displayOrder: index + 1 },
      })
    )
  );

  revalidatePath("/stp/settings/stages");
}
