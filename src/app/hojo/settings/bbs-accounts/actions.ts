"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import crypto from "crypto";

const REVALIDATE_PATH = "/hojo/settings/bbs-accounts";

export async function approveBbsAccount(id: number, staffId: number) {
  await prisma.hojoBbsAccount.update({
    where: { id },
    data: {
      status: "active",
      approvedAt: new Date(),
      approvedBy: staffId,
    },
  });

  revalidatePath(REVALIDATE_PATH);
}

export async function suspendBbsAccount(id: number) {
  await prisma.hojoBbsAccount.update({
    where: { id },
    data: { status: "suspended" },
  });

  revalidatePath(REVALIDATE_PATH);
}

export async function reactivateBbsAccount(id: number) {
  await prisma.hojoBbsAccount.update({
    where: { id },
    data: { status: "active" },
  });

  revalidatePath(REVALIDATE_PATH);
}

export async function resetBbsPassword(id: number): Promise<string> {
  // ランダム8文字の初期パスワード生成
  const initialPassword = crypto.randomBytes(4).toString("hex"); // 8文字の16進数
  const passwordHash = await bcrypt.hash(initialPassword, 12);

  await prisma.hojoBbsAccount.update({
    where: { id },
    data: {
      passwordHash,
      mustChangePassword: true,
      passwordResetRequestedAt: null, // リセット要求をクリア
    },
  });

  revalidatePath(REVALIDATE_PATH);
  return initialPassword;
}

export async function deleteBbsAccount(id: number) {
  await prisma.hojoBbsAccount.delete({
    where: { id },
  });

  revalidatePath(REVALIDATE_PATH);
}
