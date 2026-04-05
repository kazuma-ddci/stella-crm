"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { canEdit as canEditProject } from "@/lib/auth/permissions";
import type { UserPermission } from "@/types/auth";

export async function updateLoanStaffMemo(
  submissionId: number,
  memo: string
) {
  const session = await auth();
  const userType = session?.user?.userType;

  if (userType !== "staff") {
    throw new Error("権限がありません");
  }

  const permissions = (session?.user?.permissions ?? []) as UserPermission[];
  if (!canEditProject(permissions, "hojo")) {
    throw new Error("権限がありません");
  }

  const submission = await prisma.hojoFormSubmission.findUnique({
    where: { id: submissionId },
  });

  if (!submission || submission.deletedAt) {
    throw new Error("回答が見つかりません");
  }

  await prisma.hojoFormSubmission.update({
    where: { id: submissionId },
    data: { staffMemo: memo || null },
  });

  revalidatePath("/hojo/loan-submissions");
  revalidatePath("/hojo/vendor");
  revalidatePath("/hojo/lender");
}
