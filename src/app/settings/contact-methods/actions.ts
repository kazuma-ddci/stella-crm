"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireMasterDataEditPermission } from "@/lib/auth/master-data-permission";

export async function addContactMethod(data: Record<string, unknown>) {
  await requireMasterDataEditPermission();
  const maxOrder = await prisma.contactMethod.aggregate({
    _max: { displayOrder: true },
  });
  const displayOrder = (maxOrder._max.displayOrder ?? 0) + 1;

  await prisma.contactMethod.create({
    data: {
      name: data.name as string,
      displayOrder,
      isActive: data.isActive === true || data.isActive === "true",
    },
  });
  revalidatePath("/settings/contact-methods");
}

export async function updateContactMethod(id: number, data: Record<string, unknown>) {
  await requireMasterDataEditPermission();
  const updateData: Record<string, unknown> = {};
  if ("name" in data) updateData.name = data.name as string;
  if ("isActive" in data) updateData.isActive = data.isActive === true || data.isActive === "true";

  if (Object.keys(updateData).length > 0) {
    await prisma.contactMethod.update({
      where: { id },
      data: updateData,
    });
  }
  revalidatePath("/settings/contact-methods");
}

export async function deleteContactMethod(id: number) {
  await requireMasterDataEditPermission();
  await prisma.contactMethod.delete({
    where: { id },
  });
  revalidatePath("/settings/contact-methods");
}

export async function reorderContactMethods(orderedIds: number[]) {
  await requireMasterDataEditPermission();
  await prisma.$transaction(
    orderedIds.map((id, index) =>
      prisma.contactMethod.update({
        where: { id },
        data: { displayOrder: index + 1 },
      })
    )
  );
  revalidatePath("/settings/contact-methods");
}
