"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

export async function deleteCompany(id: number) {
  await prisma.masterStellaCompany.delete({
    where: { id },
  });
  revalidatePath("/companies");
}

export async function updateCompany(
  id: number,
  data: {
    name: string;
    contactPerson?: string;
    email?: string;
    phone?: string;
    note?: string;
  }
) {
  await prisma.masterStellaCompany.update({
    where: { id },
    data,
  });
  revalidatePath("/companies");
  revalidatePath(`/companies/${id}`);
}
