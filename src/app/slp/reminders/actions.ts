"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireProjectMasterDataEditPermission } from "@/lib/auth/master-data-permission";

/**
 * リマインド日数設定を更新
 */
export async function updateReminderDays(projectId: number, days: number) {
  await requireProjectMasterDataEditPermission("slp");

  if (days < 1 || days > 30) {
    throw new Error("リマインド日数は1〜30日の範囲で設定してください");
  }

  await prisma.masterProject.update({
    where: { id: projectId },
    data: { reminderDays: days },
  });

  revalidatePath("/slp/reminders");
}

/**
 * メンバーのリマインド除外フラグを切り替え
 */
export async function toggleReminderExcluded(memberId: number) {
  await requireProjectMasterDataEditPermission("slp");

  const member = await prisma.slpMember.findUnique({
    where: { id: memberId },
    select: { reminderExcluded: true },
  });
  if (!member) throw new Error("メンバーが見つかりません");

  await prisma.slpMember.update({
    where: { id: memberId },
    data: { reminderExcluded: !member.reminderExcluded },
  });

  revalidatePath("/slp/reminders");
}
