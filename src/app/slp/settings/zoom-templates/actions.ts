"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireStaffWithProjectPermission } from "@/lib/auth/staff-action";

async function requireSlpEdit() {
  return requireStaffWithProjectPermission([
    { project: "slp", level: "edit" },
  ]);
}

export async function listZoomMessageTemplates() {
  await requireSlpEdit();
  return prisma.slpZoomMessageTemplate.findMany({
    orderBy: [{ category: "asc" }, { id: "asc" }],
    include: { updatedBy: { select: { name: true } } },
  });
}

export async function updateZoomMessageTemplate(
  id: number,
  body: string,
  isActive: boolean
): Promise<{ ok: true } | { ok: false; message: string }> {
  const user = await requireSlpEdit();
  if (!body || body.trim().length === 0) {
    return { ok: false, message: "本文は必須です" };
  }
  try {
    await prisma.slpZoomMessageTemplate.update({
      where: { id },
      data: {
        body,
        isActive,
        updatedByStaffId: user.id,
      },
    });
    revalidatePath("/slp/settings/zoom-templates");
    return { ok: true };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "更新失敗" };
  }
}
