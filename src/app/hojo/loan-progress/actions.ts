"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { canEditProjectMasterDataSync } from "@/lib/auth/master-data-permission";
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

    if (!session?.user || !canEditProjectMasterDataSync(session.user, "hojo")) {
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

async function requireHojoEditStaff(): Promise<ActionResult | null> {
  const session = await auth();
  const userType = session?.user?.userType;
  if (userType !== "staff") return err("権限がありません");
  if (!session?.user || !canEditProjectMasterDataSync(session.user, "hojo")) {
    return err("権限がありません");
  }
  return null;
}

function revalidateLoanPaths() {
  revalidatePath("/hojo/loan-progress");
  revalidatePath("/hojo/vendor");
  revalidatePath("/hojo/lender");
  revalidatePath("/hojo/security-cloud/accounts");
}

export async function approveLoanUsageChange(progressId: number): Promise<ActionResult> {
  try {
    const authError = await requireHojoEditStaff();
    if (authError) return authError;

    const progress = await prisma.hojoLoanProgress.findUnique({
      where: { id: progressId },
      include: { wholesaleAccount: true },
    });
    if (!progress || !progress.loanUsagePending || !progress.wholesaleAccountId) {
      return err("承認待ちの変更が見つかりません");
    }

    const nextUsage = progress.loanUsagePending;
    await prisma.$transaction(async (tx) => {
      await tx.hojoWholesaleAccount.update({
        where: { id: progress.wholesaleAccountId! },
        data: { loanUsage: nextUsage },
      });
      await tx.hojoLoanProgress.update({
        where: { id: progress.id },
        data: {
          loanUsageApproved: nextUsage,
          loanUsagePending: null,
          loanUsageChangeRequestedAt: null,
          deletedAt: nextUsage === "有" ? null : new Date(),
        },
      });
    });

    revalidateLoanPaths();
    return ok();
  } catch (e) {
    console.error("[approveLoanUsageChange] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
}

export async function rejectLoanUsageChange(progressId: number): Promise<ActionResult> {
  try {
    const authError = await requireHojoEditStaff();
    if (authError) return authError;

    const progress = await prisma.hojoLoanProgress.findUnique({
      where: { id: progressId },
    });
    if (!progress || !progress.loanUsagePending || !progress.wholesaleAccountId) {
      return err("却下できる変更が見つかりません");
    }

    const approvedUsage = progress.loanUsageApproved ?? (progress.deletedAt ? "無" : "有");
    await prisma.$transaction(async (tx) => {
      await tx.hojoWholesaleAccount.update({
        where: { id: progress.wholesaleAccountId! },
        data: { loanUsage: approvedUsage },
      });
      await tx.hojoLoanProgress.update({
        where: { id: progress.id },
        data: {
          loanUsagePending: null,
          loanUsageChangeRequestedAt: null,
          deletedAt: approvedUsage === "有" ? null : new Date(),
        },
      });
    });

    revalidateLoanPaths();
    return ok();
  } catch (e) {
    console.error("[rejectLoanUsageChange] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
}
