"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireMasterDataEditPermission } from "@/lib/auth/master-data-permission";

export async function addOperatingCompany(data: Record<string, unknown>) {
  await requireMasterDataEditPermission();
  await prisma.operatingCompany.create({
    data: {
      companyName: data.companyName as string,
      registrationNumber: (data.registrationNumber as string) || null,
      postalCode: (data.postalCode as string) || null,
      address: (data.address as string) || null,
      representativeName: (data.representativeName as string) || null,
      phone: (data.phone as string) || null,
      bankInfo: (data.bankInfo as string) || null,
    },
  });
  revalidatePath("/settings/operating-companies");
  revalidatePath("/settings/projects");
}

export async function updateOperatingCompany(
  id: number,
  data: Record<string, unknown>
) {
  await requireMasterDataEditPermission();
  await prisma.operatingCompany.update({
    where: { id },
    data: {
      companyName: data.companyName as string,
      registrationNumber: (data.registrationNumber as string) || null,
      postalCode: (data.postalCode as string) || null,
      address: (data.address as string) || null,
      representativeName: (data.representativeName as string) || null,
      phone: (data.phone as string) || null,
      bankInfo: (data.bankInfo as string) || null,
    },
  });
  revalidatePath("/settings/operating-companies");
  revalidatePath("/settings/projects");
}

export async function deleteOperatingCompany(id: number) {
  await requireMasterDataEditPermission();
  await prisma.operatingCompany.update({
    where: { id },
    data: { isActive: false },
  });
  revalidatePath("/settings/operating-companies");
  revalidatePath("/settings/projects");
}
