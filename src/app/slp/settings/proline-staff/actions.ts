"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { ok, err, type ActionResult } from "@/lib/action-result";
import { requireStaffWithProjectPermission } from "@/lib/auth/staff-action";

export async function addMapping(data: {
  prolineStaffName: string;
  lineFriendId: number | null;
  staffId: number | null;
}): Promise<ActionResult> {
  // 認証: SLPプロジェクトの編集権限以上
  // 注: getSession() の redirect を伝播させるため try/catch の外で呼ぶ
  await requireStaffWithProjectPermission([{ project: "slp", level: "edit" }]);
  try {
    if (!data.prolineStaffName.trim()) {
      return err("プロライン担当者名は必須です");
    }

    await prisma.slpProlineStaffMapping.create({
      data: {
        prolineStaffName: data.prolineStaffName.trim(),
        lineFriendId: data.lineFriendId,
        staffId: data.staffId,
      },
    });
    revalidatePath("/slp/settings/proline-staff");
    return ok();
  } catch (e) {
    console.error("[addMapping] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
}

export async function updateMapping(
  id: number,
  data: {
    prolineStaffName: string;
    lineFriendId: number | null;
    staffId: number | null;
  }
): Promise<ActionResult> {
  await requireStaffWithProjectPermission([{ project: "slp", level: "edit" }]);
  try {
    if (!data.prolineStaffName.trim()) {
      return err("プロライン担当者名は必須です");
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
    return ok();
  } catch (e) {
    console.error("[updateMapping] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
}

export async function deleteMapping(id: number): Promise<ActionResult> {
  await requireStaffWithProjectPermission([{ project: "slp", level: "edit" }]);
  try {
    await prisma.slpProlineStaffMapping.delete({ where: { id } });
    revalidatePath("/slp/settings/proline-staff");
    return ok();
  } catch (e) {
    console.error("[deleteMapping] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
}
