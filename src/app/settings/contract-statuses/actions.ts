"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireMasterDataEditPermission } from "@/lib/auth/master-data-permission";
import { toBoolean } from "@/lib/utils";

export async function addContractStatus(data: Record<string, unknown>) {
  await requireMasterDataEditPermission();
  const maxOrder = await prisma.masterContractStatus.aggregate({
    _max: { displayOrder: true },
  });
  const displayOrder = (maxOrder._max.displayOrder ?? 0) + 1;

  const statusType = (data.statusType as string) || "progress";
  const isTerminal = statusType !== "progress" && statusType !== "pending";

  await prisma.masterContractStatus.create({
    data: {
      name: data.name as string,
      displayOrder,
      statusType,
      isTerminal,
      isActive: toBoolean(data.isActive),
    },
  });
  revalidatePath("/settings/contract-statuses");
}

export async function updateContractStatus(id: number, data: Record<string, unknown>) {
  await requireMasterDataEditPermission();
  const updateData: Record<string, unknown> = {};
  if ("name" in data) updateData.name = data.name as string;
  if ("statusType" in data) {
    const statusType = data.statusType as string;
    updateData.statusType = statusType;
    // isTerminalをstatusTypeから自動計算
    updateData.isTerminal = statusType !== "progress" && statusType !== "pending";
  }
  if ("isActive" in data) updateData.isActive = toBoolean(data.isActive);

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
