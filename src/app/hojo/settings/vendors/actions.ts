"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireProjectMasterDataEditPermission } from "@/lib/auth/master-data-permission";

function generateToken(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let token = "";
  for (let i = 0; i < 32; i++) {
    token += chars[Math.floor(Math.random() * chars.length)];
  }
  return token;
}

export async function addVendor(data: Record<string, unknown>) {
  await requireProjectMasterDataEditPermission();

  const maxOrder = await prisma.hojoVendor.aggregate({
    _max: { displayOrder: true },
  });
  const displayOrder = (maxOrder._max.displayOrder ?? 0) + 1;

  await prisma.hojoVendor.create({
    data: {
      name: String(data.name).trim(),
      accessToken: generateToken(),
      displayOrder,
      isActive: data.isActive === true || data.isActive === "true",
    },
  });
  revalidatePath("/hojo/settings/vendors");
}

export async function updateVendor(id: number, data: Record<string, unknown>) {
  await requireProjectMasterDataEditPermission();
  const updateData: Record<string, unknown> = {};
  if ("name" in data) updateData.name = String(data.name).trim();
  if ("isActive" in data) updateData.isActive = data.isActive === true || data.isActive === "true";

  if (Object.keys(updateData).length > 0) {
    await prisma.hojoVendor.update({
      where: { id },
      data: updateData,
    });
  }
  revalidatePath("/hojo/settings/vendors");
}

export async function deleteVendor(id: number) {
  await requireProjectMasterDataEditPermission();

  const usageCount = await prisma.hojoApplicationSupport.count({
    where: { vendorId: id, deletedAt: null },
  });
  if (usageCount > 0) {
    throw new Error(`このベンダーは${usageCount}件の申請管理で使用中のため削除できません`);
  }

  await prisma.hojoVendor.delete({
    where: { id },
  });
  revalidatePath("/hojo/settings/vendors");
}

export async function reorderVendors(orderedIds: number[]) {
  await requireProjectMasterDataEditPermission();
  await prisma.$transaction(
    orderedIds.map((id, index) =>
      prisma.hojoVendor.update({
        where: { id },
        data: { displayOrder: index + 1 },
      })
    )
  );
  revalidatePath("/hojo/settings/vendors");
}
