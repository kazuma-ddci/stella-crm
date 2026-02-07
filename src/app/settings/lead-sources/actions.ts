"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireMasterDataEditPermission } from "@/lib/auth/master-data-permission";

export async function addLeadSource(data: Record<string, unknown>) {
  await requireMasterDataEditPermission();
  const maxOrder = await prisma.stpLeadSource.aggregate({
    _max: { displayOrder: true },
  });
  const displayOrder = (maxOrder._max.displayOrder ?? 0) + 1;

  await prisma.stpLeadSource.create({
    data: {
      name: data.name as string,
      displayOrder,
      isActive: data.isActive === true || data.isActive === "true",
    },
  });
  revalidatePath("/settings/lead-sources");
}

export async function updateLeadSource(id: number, data: Record<string, unknown>) {
  await requireMasterDataEditPermission();
  await prisma.stpLeadSource.update({
    where: { id },
    data: {
      name: data.name as string,
      isActive: data.isActive === true || data.isActive === "true",
    },
  });
  revalidatePath("/settings/lead-sources");
}

export async function deleteLeadSource(id: number) {
  await requireMasterDataEditPermission();
  await prisma.stpLeadSource.delete({
    where: { id },
  });
  revalidatePath("/settings/lead-sources");
}

export async function reorderLeadSources(orderedIds: number[]) {
  await requireMasterDataEditPermission();
  await prisma.$transaction(
    orderedIds.map((id, index) =>
      prisma.stpLeadSource.update({
        where: { id },
        data: { displayOrder: index + 1 },
      })
    )
  );
  revalidatePath("/settings/lead-sources");
}
