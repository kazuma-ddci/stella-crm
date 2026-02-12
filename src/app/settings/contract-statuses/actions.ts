"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireMasterDataEditPermission } from "@/lib/auth/master-data-permission";

export async function addContractStatus(data: Record<string, unknown>) {
  await requireMasterDataEditPermission();
  const maxOrder = await prisma.masterContractStatus.aggregate({
    _max: { displayOrder: true },
  });
  const displayOrder = (maxOrder._max.displayOrder ?? 0) + 1;

  await prisma.masterContractStatus.create({
    data: {
      name: data.name as string,
      displayOrder,
      isTerminal: data.isTerminal === true || data.isTerminal === "true",
      isActive: data.isActive === true || data.isActive === "true",
    },
  });
  revalidatePath("/settings/contract-statuses");
}

export async function updateContractStatus(id: number, data: Record<string, unknown>) {
  await requireMasterDataEditPermission();
  const updateData: Record<string, unknown> = {};
  if ("name" in data) updateData.name = data.name as string;
  if ("isTerminal" in data) updateData.isTerminal = data.isTerminal === true || data.isTerminal === "true";
  if ("isActive" in data) updateData.isActive = data.isActive === true || data.isActive === "true";

  if (Object.keys(updateData).length > 0) {
    await prisma.masterContractStatus.update({
      where: { id },
      data: updateData,
    });
  }
  revalidatePath("/settings/contract-statuses");
}

export async function deleteContractStatus(id: number) {
  await requireMasterDataEditPermission();
  await prisma.masterContractStatus.delete({
    where: { id },
  });
  revalidatePath("/settings/contract-statuses");
}

export async function reorderContractStatuses(orderedIds: number[]) {
  await requireMasterDataEditPermission();
  await prisma.$transaction(
    orderedIds.map((id, index) =>
      prisma.masterContractStatus.update({
        where: { id },
        data: { displayOrder: index + 1 },
      })
    )
  );
  revalidatePath("/settings/contract-statuses");
}
