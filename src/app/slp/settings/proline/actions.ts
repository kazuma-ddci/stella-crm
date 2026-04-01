"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireProjectMasterDataEditPermission } from "@/lib/auth/master-data-permission";

export async function updateSlpProlineAccount(id: number, data: Record<string, unknown>) {
  await requireProjectMasterDataEditPermission();

  const updateData: Record<string, unknown> = {};
  if ("label" in data) updateData.label = String(data.label).trim();
  if ("email" in data) updateData.email = String(data.email).trim();
  if ("password" in data) updateData.password = String(data.password).trim();
  if ("loginUrl" in data) updateData.loginUrl = data.loginUrl ? String(data.loginUrl).trim() : null;

  if (Object.keys(updateData).length > 0) {
    await prisma.slpProlineAccount.update({
      where: { id },
      data: updateData,
    });
  }

  revalidatePath("/slp/settings/proline");
}
