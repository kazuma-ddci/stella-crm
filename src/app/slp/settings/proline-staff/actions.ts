"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function addMapping(data: {
  prolineStaffName: string;
  lineFriendId: number | null;
  staffId: number | null;
}) {
  if (!data.prolineStaffName.trim()) {
    throw new Error("プロライン担当者名は必須です");
  }

  await prisma.slpProlineStaffMapping.create({
    data: {
      prolineStaffName: data.prolineStaffName.trim(),
      lineFriendId: data.lineFriendId,
      staffId: data.staffId,
    },
  });
  revalidatePath("/slp/settings/proline-staff");
}

export async function updateMapping(
  id: number,
  data: {
    prolineStaffName: string;
    lineFriendId: number | null;
    staffId: number | null;
  }
) {
  if (!data.prolineStaffName.trim()) {
    throw new Error("プロライン担当者名は必須です");
  }

  await prisma.slpProlineStaffMapping.update({
    where: { id },
    data: {
      prolineStaffName: data.prolineStaffName.trim(),
      lineFriendId: data.lineFriendId,
      staffId: data.staffId,
    },
  });
  revalidatePath("/slp/settings/proline-staff");
}

export async function deleteMapping(id: number) {
  await prisma.slpProlineStaffMapping.delete({ where: { id } });
  revalidatePath("/slp/settings/proline-staff");
}
