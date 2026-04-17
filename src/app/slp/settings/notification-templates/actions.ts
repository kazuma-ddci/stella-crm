"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireStaffWithProjectPermission } from "@/lib/auth/staff-action";
import { ok, err, type ActionResult } from "@/lib/action-result";

async function requireSlpEdit() {
  return requireStaffWithProjectPermission([{ project: "slp", level: "edit" }]);
}

export async function listNotificationTemplates() {
  await requireSlpEdit();
  return prisma.slpNotificationTemplate.findMany({
    orderBy: [
      { recipient: "asc" },
      { category: "asc" },
      { roundType: "asc" },
      { source: "asc" },
      { trigger: "asc" },
    ],
    include: { updatedBy: { select: { name: true } } },
  });
}

export async function updateNotificationTemplate(params: {
  id: number;
  body: string;
  isActive: boolean;
}): Promise<ActionResult<{ id: number }>> {
  try {
    const user = await requireSlpEdit();
    if (!params.body || params.body.trim().length === 0) {
      return err("本文は必須です");
    }
    await prisma.slpNotificationTemplate.update({
      where: { id: params.id },
      data: {
        body: params.body,
        isActive: params.isActive,
        updatedByStaffId: user.id,
      },
    });
    revalidatePath("/slp/settings/notification-templates");
    return ok({ id: params.id });
  } catch (e) {
    return err(e instanceof Error ? e.message : "更新に失敗しました");
  }
}
