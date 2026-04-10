"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { canEdit as canEditProject } from "@/lib/auth/permissions";
import type { UserPermission } from "@/types/auth";
import bcrypt from "bcryptjs";
import { ok, err, type ActionResult } from "@/lib/action-result";

const REVALIDATE_PATH = "/hojo/bbs";

async function requireBbsEditPermission(): Promise<void> {
  const session = await auth();
  const userType = session?.user?.userType;
  if (userType === "bbs") return; // BBSユーザーは編集可
  if (userType === "staff") {
    const permissions = (session?.user?.permissions ?? []) as UserPermission[];
    if (canEditProject(permissions, "hojo")) return; // スタッフのhojo edit以上も編集可
  }
  throw new Error("権限がありません");
}

export async function registerBbsAccount(data: {
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

    // メールアドレスの重複チェック（BBS、スタッフ、外部ユーザー全体で）
    const existingBbs = await prisma.hojoBbsAccount.findUnique({
      where: { email: email.trim() },
    });
    if (existingBbs) {
      return err("このメールアドレスは既に登録されています");
    }
    const existingStaff = await prisma.masterStaff.findUnique({
      where: { email: email.trim() },
    });
    if (existingStaff) {
      return err("このメールアドレスは既に使用されています");
    }

    const passwordHash = await bcrypt.hash(password, 12);

    await prisma.hojoBbsAccount.create({
      data: {
        name: name.trim(),
        email: email.trim(),
        passwordHash,
      },
    });
    return ok();
  } catch (e) {
    console.error("[registerBbsAccount] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function loginBbsAccount(email: string, _password: string) {
  const account = await prisma.hojoBbsAccount.findUnique({
    where: { email },
  });

  if (!account) {
    return { error: "メールアドレスまたはパスワードが正しくありません" };
  }

  if (account.status === "pending_approval") {
    return { error: "アカウントは認証待ちです。しばらくお待ちください" };
  }

  if (account.status === "suspended") {
    return { error: "アカウントが停止されています" };
  }

  return { success: true };
}

export async function recordPasswordResetRequest(email: string) {
  const account = await prisma.hojoBbsAccount.findUnique({
    where: { email },
  });
  if (account) {
    await prisma.hojoBbsAccount.update({
      where: { id: account.id },
      data: { passwordResetRequestedAt: new Date() },
    });
  }
}

export async function updateBbsFields(
  applicationSupportId: number,
  data: { bbsStatusId?: number | null; bbsMemo?: string }
): Promise<ActionResult> {
  try {
    await requireBbsEditPermission();
    const updateData: Record<string, unknown> = {};

    if (data.bbsStatusId !== undefined) {
      updateData.bbsStatusId = data.bbsStatusId || null;
    }
    if (data.bbsMemo !== undefined) {
      updateData.bbsMemo = data.bbsMemo || null;
    }

    if (Object.keys(updateData).length > 0) {
      await prisma.hojoApplicationSupport.update({
        where: { id: applicationSupportId },
        data: updateData,
      });
    }

    revalidatePath(REVALIDATE_PATH);
    revalidatePath("/hojo/application-support");
    return ok();
  } catch (e) {
    console.error("[updateBbsFields] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
}

export async function changeBbsPassword(
  accountId: number,
  newPassword: string
): Promise<ActionResult> {
  try {
    if (newPassword.length < 8) {
      return err("パスワードは8文字以上にしてください");
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);

    await prisma.hojoBbsAccount.update({
      where: { id: accountId },
      data: {
        passwordHash,
        mustChangePassword: false,
      },
    });
    return ok();
  } catch (e) {
    console.error("[changeBbsPassword] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
}

export async function getBbsPageData() {
  const records = await prisma.hojoApplicationSupport.findMany({
    where: { deletedAt: null },
    include: {
      lineFriend: true,
    },
    orderBy: { id: "asc" },
  });

  return records.map((r) => ({
    id: r.id,
    applicantName: r.applicantName || "-",
    formAnswerDate: r.formAnswerDate?.toISOString().slice(0, 10) ?? "-",
    bbsStatusId: r.bbsStatusId,
    bbsTransferAmount: r.bbsTransferAmount,
    bbsTransferDate: r.bbsTransferDate?.toISOString().slice(0, 10) ?? "-",
    subsidyReceivedDate: r.subsidyReceivedDate?.toISOString().slice(0, 10) ?? "-",
    alkesMemo: r.alkesMemo || "",
    bbsMemo: r.bbsMemo || "",
  }));
}
