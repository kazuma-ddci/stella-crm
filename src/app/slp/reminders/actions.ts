"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireProjectMasterDataEditPermission } from "@/lib/auth/master-data-permission";
import { ok, err, type ActionResult } from "@/lib/action-result";

/**
 * リマインド日数設定を更新
 */
export async function updateReminderDays(projectId: number, days: number): Promise<ActionResult> {
  try {
    await requireProjectMasterDataEditPermission("slp");

    if (days < 1 || days > 30) {
      return err("リマインド日数は1〜30日の範囲で設定してください");
    }

    await prisma.masterProject.update({
      where: { id: projectId },
      data: { reminderDays: days },
    });

    revalidatePath("/slp/reminders");
    return ok();
  } catch (e) {
    console.error("[updateReminderDays] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
}

/**
 * メンバーのリマインド除外フラグを切り替え
 */
export async function toggleReminderExcluded(memberId: number): Promise<ActionResult> {
  try {
    await requireProjectMasterDataEditPermission("slp");

    const member = await prisma.slpMember.findUnique({
      where: { id: memberId },
      select: { reminderExcluded: true },
    });
    if (!member) return err("メンバーが見つかりません");

    await prisma.slpMember.update({
      where: { id: memberId },
      data: { reminderExcluded: !member.reminderExcluded },
    });

    revalidatePath("/slp/reminders");
    return ok();
  } catch (e) {
    console.error("[toggleReminderExcluded] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
}
