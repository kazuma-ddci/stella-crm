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
    websiteUrl?: string;
    industry?: string;
    revenueScale?: string;
    note?: string;
  }
) {
  await prisma.masterStellaCompany.update({
    where: { id },
    data: {
      name: data.name,
      websiteUrl: data.websiteUrl || null,
      industry: data.industry || null,
      revenueScale: data.revenueScale || null,
      note: data.note || null,
    },
  });
  revalidatePath("/companies");
  revalidatePath(`/companies/${id}`);
}
