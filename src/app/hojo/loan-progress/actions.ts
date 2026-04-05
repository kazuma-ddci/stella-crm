"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { canEdit as canEditProject } from "@/lib/auth/permissions";
import type { UserPermission } from "@/types/auth";

export async function updateProgressStaffMemo(
  progressId: number,
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

  const progress = await prisma.hojoLoanProgress.findUnique({
    where: { id: progressId },
  });

  if (!progress || progress.deletedAt) {
    throw new Error("進捗データが見つかりません");
  }

  await prisma.hojoLoanProgress.update({
    where: { id: progressId },
    data: { staffMemo: memo || null },
  });

  revalidatePath("/hojo/loan-progress");
  revalidatePath("/hojo/vendor");
  revalidatePath("/hojo/lender");
}
