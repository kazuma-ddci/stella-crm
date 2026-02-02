"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

export async function addContactMethod(data: Record<string, unknown>) {
  // 最大の表示順を取得して+1
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
  await prisma.contactMethod.update({
    where: { id },
    data: {
      name: data.name as string,
      isActive: data.isActive === true || data.isActive === "true",
    },
  });
  revalidatePath("/settings/contact-methods");
}

export async function deleteContactMethod(id: number) {
  await prisma.contactMethod.delete({
    where: { id },
  });
  revalidatePath("/settings/contact-methods");
}

export async function reorderContactMethods(orderedIds: number[]) {
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
