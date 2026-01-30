"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

export async function addContactMethod(data: Record<string, unknown>) {
  await prisma.stpContactMethod.create({
    data: {
      name: data.name as string,
      displayOrder: data.displayOrder ? Number(data.displayOrder) : 0,
      isActive: data.isActive === true || data.isActive === "true",
    },
  });
  revalidatePath("/stp/settings/contact-methods");
}

export async function updateContactMethod(id: number, data: Record<string, unknown>) {
  await prisma.stpContactMethod.update({
    where: { id },
    data: {
      name: data.name as string,
      displayOrder: data.displayOrder ? Number(data.displayOrder) : 0,
      isActive: data.isActive === true || data.isActive === "true",
    },
  });
  revalidatePath("/stp/settings/contact-methods");
}

export async function deleteContactMethod(id: number) {
  await prisma.stpContactMethod.delete({
    where: { id },
  });
  revalidatePath("/stp/settings/contact-methods");
}
