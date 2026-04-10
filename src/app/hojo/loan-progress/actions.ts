"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { canEdit as canEditProject } from "@/lib/auth/permissions";
import type { UserPermission } from "@/types/auth";
import { ok, err, type ActionResult } from "@/lib/action-result";

export async function updateProgressStaffMemo(
  progressId: number,
  memo: string
): Promise<ActionResult> {
  try {
    const session = await auth();
    const userType = session?.user?.userType;

    if (userType !== "staff") {
      return err("権限がありません");
    }

    const permissions = (session?.user?.permissions ?? []) as UserPermission[];
    if (!canEditProject(permissions, "hojo")) {
      return err("権限がありません");
    }

    const progress = await prisma.hojoLoanProgress.findUnique({
      where: { id: progressId },
    });

    if (!progress || progress.deletedAt) {
      return err("進捗データが見つかりません");
    }

    await prisma.hojoLoanProgress.update({
      where: { id: progressId },
      data: { staffMemo: memo || null },
    });

    revalidatePath("/hojo/loan-progress");
    revalidatePath("/hojo/vendor");
    revalidatePath("/hojo/lender");
    return ok();
  } catch (e) {
    console.error("[updateProgressStaffMemo] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
}
