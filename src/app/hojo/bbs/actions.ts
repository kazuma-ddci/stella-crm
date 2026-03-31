"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

const REVALIDATE_PATH = "/hojo/bbs";

export async function registerBbsAccount(data: {
  name: string;
  email: string;
  password: string;
}) {
  const { name, email, password } = data;

  if (!name.trim() || !email.trim() || !password.trim()) {
    throw new Error("すべての項目を入力してください");
  }
  if (password.length < 8) {
    throw new Error("パスワードは8文字以上にしてください");
  }

  // メールアドレスの重複チェック（BBS、スタッフ、外部ユーザー全体で）
  const existingBbs = await prisma.hojoBbsAccount.findUnique({
    where: { email: email.trim() },
  });
  if (existingBbs) {
    throw new Error("このメールアドレスは既に登録されています");
  }
  const existingStaff = await prisma.masterStaff.findUnique({
    where: { email: email.trim() },
  });
  if (existingStaff) {
    throw new Error("このメールアドレスは既に使用されています");
  }

  const passwordHash = await bcrypt.hash(password, 12);

  await prisma.hojoBbsAccount.create({
    data: {
      name: name.trim(),
      email: email.trim(),
      passwordHash,
    },
  });
}

export async function loginBbsAccount(email: string, password: string) {
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
) {
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
}

export async function changeBbsPassword(
  accountId: number,
  newPassword: string
) {
  if (newPassword.length < 8) {
    throw new Error("パスワードは8文字以上にしてください");
  }

  const passwordHash = await bcrypt.hash(newPassword, 12);

  await prisma.hojoBbsAccount.update({
    where: { id: accountId },
    data: {
      passwordHash,
      mustChangePassword: false,
    },
  });
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
