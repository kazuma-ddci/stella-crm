"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

export async function addContractStatus(data: Record<string, unknown>) {
  // 最大の表示順を取得して+1
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
  await prisma.masterContractStatus.update({
    where: { id },
    data: {
      name: data.name as string,
      isTerminal: data.isTerminal === true || data.isTerminal === "true",
      isActive: data.isActive === true || data.isActive === "true",
    },
  });
  revalidatePath("/settings/contract-statuses");
}

export async function deleteContractStatus(id: number) {
  await prisma.masterContractStatus.delete({
    where: { id },
  });
  revalidatePath("/settings/contract-statuses");
}

export async function reorderContractStatuses(orderedIds: number[]) {
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
