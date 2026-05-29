"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { canEditProjectMasterDataSync } from "@/lib/auth/master-data-permission";
import { ok, err, type ActionResult } from "@/lib/action-result";

export async function updateLoanStaffMemo(
  submissionId: number,
  memo: string
): Promise<ActionResult> {
  try {
    const session = await auth();
    const userType = session?.user?.userType;

    if (userType !== "staff") {
      return err("権限がありません");
    }

    if (!session?.user || !canEditProjectMasterDataSync(session.user, "hojo")) {
      return err("権限がありません");
    }

    const submission = await prisma.hojoFormSubmission.findUnique({
      where: { id: submissionId },
    });

    if (!submission || submission.deletedAt) {
      return err("回答が見つかりません");
    }

    await prisma.hojoFormSubmission.update({
      where: { id: submissionId },
      data: { staffMemo: memo || null },
    });

    revalidatePath("/hojo/loan-submissions");
    revalidatePath("/hojo/vendor");
    revalidatePath("/hojo/lender");
    return ok();
  } catch (e) {
    console.error("[updateLoanStaffMemo] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
}
