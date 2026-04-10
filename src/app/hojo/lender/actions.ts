"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import bcrypt from "bcryptjs";
import { ok, err, type ActionResult } from "@/lib/action-result";

const REVALIDATE_PATH = "/hojo/lender";

export async function registerLenderAccount(data: {
  name: string;
  email: string;
  password: string;
}): Promise<ActionResult> {
  try {
    const { name, email, password } = data;

    if (!name.trim() || !email.trim() || !password.trim()) {
      return err("すべての項目を入力してください");
    }
    if (password.length < 8) {
      return err("パスワードは8文字以上にしてください");
    }

    // メールアドレスの重複チェック（貸金業社、BBS、ベンダー、スタッフ全体で）
    const existingLender = await prisma.hojoLenderAccount.findUnique({
      where: { email: email.trim() },
    });
    if (existingLender) {
      return err("このメールアドレスは既に登録されています");
    }
    const existingBbs = await prisma.hojoBbsAccount.findUnique({
      where: { email: email.trim() },
    });
    if (existingBbs) {
      return err("このメールアドレスは既に使用されています");
    }
    const existingVendor = await prisma.hojoVendorAccount.findUnique({
      where: { email: email.trim() },
    });
    if (existingVendor) {
      return err("このメールアドレスは既に使用されています");
    }
    const existingStaff = await prisma.masterStaff.findUnique({
      where: { email: email.trim() },
    });
    if (existingStaff) {
      return err("このメールアドレスは既に使用されています");
    }

    const passwordHash = await bcrypt.hash(password, 12);

    await prisma.hojoLenderAccount.create({
      data: {
        name: name.trim(),
        email: email.trim(),
        passwordHash,
      },
    });
    return ok();
  } catch (e) {
    console.error("[registerLenderAccount] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
}

export async function recordLenderPasswordResetRequest(email: string) {
  const account = await prisma.hojoLenderAccount.findUnique({
    where: { email },
  });
  if (account) {
    await prisma.hojoLenderAccount.update({
      where: { id: account.id },
      data: { passwordResetRequestedAt: new Date() },
    });
  }
}

export async function changeLenderPassword(
  accountId: number,
  newPassword: string
): Promise<ActionResult> {
  try {
    if (newPassword.length < 8) {
      return err("パスワードは8文字以上にしてください");
    }

    const session = await auth();
    const userType = session?.user?.userType;
    if (userType !== "lender" && userType !== "staff") {
      return err("権限がありません");
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);

    await prisma.hojoLenderAccount.update({
      where: { id: accountId },
      data: {
        passwordHash,
        mustChangePassword: false,
      },
    });

    revalidatePath(REVALIDATE_PATH);
    return ok();
  } catch (e) {
    console.error("[changeLenderPassword] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
}

// ========== 借入申込フォーム 貸金業社備考更新 ==========

export async function updateLoanLenderMemo(
  submissionId: number,
  memo: string
): Promise<ActionResult> {
  try {
    const session = await auth();
    const userType = session?.user?.userType;

    if (userType !== "lender" && userType !== "staff") {
      return err("権限がありません");
    }

    // スタッフの場合はhojo edit権限チェック
    if (userType === "staff") {
      const { canEdit: canEditProject } = await import("@/lib/auth/permissions");
      const permissions = (session?.user?.permissions ?? []) as import("@/types/auth").UserPermission[];
      if (!canEditProject(permissions, "hojo")) {
        return err("権限がありません");
      }
    }

    const submission = await prisma.hojoFormSubmission.findUnique({
      where: { id: submissionId },
    });

    if (!submission || submission.deletedAt) {
      return err("回答が見つかりません");
    }

    await prisma.hojoFormSubmission.update({
      where: { id: submissionId },
      data: { lenderMemo: memo || null },
    });

    revalidatePath(REVALIDATE_PATH);
    revalidatePath("/hojo/loan-submissions");
    revalidatePath("/hojo/vendor");
    return ok();
  } catch (e) {
    console.error("[updateLoanLenderMemo] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
}

// ========== 顧客進捗管理 貸金業社フィールド更新 ==========

const LENDER_EDITABLE_FIELDS = [
  "statusId", "memo", "memorandum", "funds",
  "repaymentDate", "repaymentAmount", "principalAmount", "interestAmount",
  "overshortAmount", "operationFee", "redemptionAmount", "redemptionDate", "endMemo",
];

export async function updateLenderProgress(
  progressId: number,
  field: string,
  value: string
): Promise<ActionResult> {
  try {
    const session = await auth();
    const userType = session?.user?.userType;

    if (userType !== "lender" && userType !== "staff") {
      return err("権限がありません");
    }

    if (userType === "staff") {
      const { canEdit: canEditProject } = await import("@/lib/auth/permissions");
      const permissions = (session?.user?.permissions ?? []) as import("@/types/auth").UserPermission[];
      if (!canEditProject(permissions, "hojo")) {
        return err("権限がありません");
      }
    }

    if (!LENDER_EDITABLE_FIELDS.includes(field)) {
      return err("このフィールドは編集できません");
    }

    const progress = await prisma.hojoLoanProgress.findUnique({ where: { id: progressId } });
    if (!progress || progress.deletedAt) return err("レコードが見つかりません");

    const updateData: Record<string, unknown> = {};

    const dateFields = ["repaymentDate", "redemptionDate"];
    const decimalFields = ["repaymentAmount", "principalAmount", "interestAmount", "overshortAmount", "operationFee", "redemptionAmount"];

    if (field === "statusId") {
      updateData.statusId = value ? Number(value) : null;
    } else if (dateFields.includes(field)) {
      updateData[field] = value ? new Date(value) : null;
    } else if (decimalFields.includes(field)) {
      updateData[field] = value ? Number(value.replace(/,/g, "")) : null;
    } else {
      updateData[field] = value || null;
    }

    await prisma.hojoLoanProgress.update({ where: { id: progressId }, data: updateData });
    revalidatePath(REVALIDATE_PATH);
    revalidatePath("/hojo/loan-progress");
    revalidatePath("/hojo/vendor");
    return ok();
  } catch (e) {
    console.error("[updateLenderProgress] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
}
