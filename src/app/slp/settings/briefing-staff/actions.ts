"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function addMapping(data: {
  briefingStaffName: string;
  lineFriendId: number | null;
  staffId: number | null;
}) {
  if (!data.briefingStaffName.trim()) {
    throw new Error("概要案内担当者名は必須です");
  }

  await prisma.slpBriefingStaffMapping.create({
    data: {
      briefingStaffName: data.briefingStaffName.trim(),
      lineFriendId: data.lineFriendId,
      staffId: data.staffId,
    },
  });
  revalidatePath("/slp/settings/briefing-staff");
}

export async function updateMapping(
  id: number,
  data: {
    briefingStaffName: string;
    lineFriendId: number | null;
    staffId: number | null;
  }
) {
  if (!data.briefingStaffName.trim()) {
    throw new Error("概要案内担当者名は必須です");
  }

  await prisma.slpBriefingStaffMapping.update({
    where: { id },
    data: {
      briefingStaffName: data.briefingStaffName.trim(),
      lineFriendId: data.lineFriendId,
      staffId: data.staffId,
    },
  });
  revalidatePath("/slp/settings/briefing-staff");
}

export async function deleteMapping(id: number) {
  await prisma.slpBriefingStaffMapping.delete({ where: { id } });
  revalidatePath("/slp/settings/briefing-staff");
}
