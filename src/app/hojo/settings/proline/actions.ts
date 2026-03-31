"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireProjectMasterDataEditPermission } from "@/lib/auth/master-data-permission";

export async function updateProlineAccount(id: number, data: Record<string, unknown>) {
  await requireProjectMasterDataEditPermission();

  const updateData: Record<string, unknown> = {};
  if ("label" in data) updateData.label = String(data.label).trim();
  if ("email" in data) updateData.email = String(data.email).trim();
  if ("password" in data) updateData.password = String(data.password).trim();

  if (Object.keys(updateData).length > 0) {
    await prisma.hojoProlineAccount.update({
      where: { id },
      data: updateData,
    });
  }

  revalidatePath("/hojo/settings/proline");
}
