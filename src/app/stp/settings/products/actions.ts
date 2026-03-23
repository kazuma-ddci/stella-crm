"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireProjectMasterDataEditPermission } from "@/lib/auth/master-data-permission";

export async function addStpProduct(data: Record<string, unknown>) {
  await requireProjectMasterDataEditPermission("stp");

  const maxOrder = await prisma.stpProduct.aggregate({
    _max: { displayOrder: true },
  });
  const displayOrder = (maxOrder._max.displayOrder ?? 0) + 1;

  await prisma.stpProduct.create({
    data: {
      name: data.name as string,
      displayOrder,
      isActive: data.isActive === true || data.isActive === "true",
    },
  });
  revalidatePath("/stp/settings/products");
}

export async function updateStpProduct(id: number, data: Record<string, unknown>) {
  await requireProjectMasterDataEditPermission("stp");
  const updateData: Record<string, unknown> = {};
  if ("name" in data) updateData.name = data.name as string;
  if ("isActive" in data) updateData.isActive = data.isActive === true || data.isActive === "true";

  if (Object.keys(updateData).length > 0) {
    await prisma.stpProduct.update({
      where: { id },
      data: updateData,
    });
  }
  revalidatePath("/stp/settings/products");
}

export async function deleteStpProduct(id: number) {
  await requireProjectMasterDataEditPermission("stp");
  await prisma.stpProduct.delete({
    where: { id },
  });
  revalidatePath("/stp/settings/products");
}

export async function reorderStpProducts(orderedIds: number[]) {
  await requireProjectMasterDataEditPermission("stp");
  await prisma.$transaction(
    orderedIds.map((id, index) =>
      prisma.stpProduct.update({
        where: { id },
        data: { displayOrder: index + 1 },
      })
    )
  );
  revalidatePath("/stp/settings/products");
}
