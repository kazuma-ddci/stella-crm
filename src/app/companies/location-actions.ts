"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

export async function getLocations(companyId: number) {
  const locations = await prisma.stellaCompanyLocation.findMany({
    where: { companyId, deletedAt: null },
    orderBy: [{ isPrimary: "desc" }, { id: "asc" }],
  });
  return locations.map((l) => ({
    id: l.id,
    companyId: l.companyId,
    name: l.name,
    address: l.address,
    phone: l.phone,
    email: l.email,
    isPrimary: l.isPrimary,
    note: l.note,
    createdAt: l.createdAt.toISOString(),
    updatedAt: l.updatedAt.toISOString(),
  }));
}

export async function addLocation(
  companyId: number,
  data: Record<string, unknown>
) {
  // isPrimary が true の場合、他の拠点の isPrimary を false にする
  if (data.isPrimary) {
    await prisma.stellaCompanyLocation.updateMany({
      where: { companyId, isPrimary: true, deletedAt: null },
      data: { isPrimary: false },
    });
  }

  const location = await prisma.stellaCompanyLocation.create({
    data: {
      companyId,
      name: data.name as string,
      address: (data.address as string) || null,
      phone: (data.phone as string) || null,
      email: (data.email as string) || null,
      isPrimary: (data.isPrimary as boolean) || false,
      note: (data.note as string) || null,
    },
  });

  revalidatePath("/companies");
  return {
    id: location.id,
    companyId: location.companyId,
    name: location.name,
    address: location.address,
    phone: location.phone,
    email: location.email,
    isPrimary: location.isPrimary,
    note: location.note,
    createdAt: location.createdAt.toISOString(),
    updatedAt: location.updatedAt.toISOString(),
  };
}

export async function updateLocation(
  id: number,
  data: Record<string, unknown>
) {
  const existing = await prisma.stellaCompanyLocation.findUnique({
    where: { id },
  });
  if (!existing) throw new Error("Location not found");

  // isPrimary が true の場合、他の拠点の isPrimary を false にする
  if (data.isPrimary) {
    await prisma.stellaCompanyLocation.updateMany({
      where: { companyId: existing.companyId, isPrimary: true, deletedAt: null, NOT: { id } },
      data: { isPrimary: false },
    });
  }

  const location = await prisma.stellaCompanyLocation.update({
    where: { id },
    data: {
      name: data.name as string,
      address: (data.address as string) || null,
      phone: (data.phone as string) || null,
      email: (data.email as string) || null,
      isPrimary: (data.isPrimary as boolean) || false,
      note: (data.note as string) || null,
    },
  });

  revalidatePath("/companies");
  return {
    id: location.id,
    companyId: location.companyId,
    name: location.name,
    address: location.address,
    phone: location.phone,
    email: location.email,
    isPrimary: location.isPrimary,
    note: location.note,
    createdAt: location.createdAt.toISOString(),
    updatedAt: location.updatedAt.toISOString(),
  };
}

export async function deleteLocation(id: number) {
  // 論理削除：deletedAtに現在日時を設定
  await prisma.stellaCompanyLocation.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
  revalidatePath("/companies");
}
