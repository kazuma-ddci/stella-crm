"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { requireStaffWithProjectPermission } from "@/lib/auth/staff-action";

const REVALIDATE_PATH = "/hojo/settings/bbs-accounts";

// このファイルの全関数は補助金プロジェクトの編集権限以上の社内スタッフのみ実行可能。
async function requireHojoEditStaff() {
  await requireStaffWithProjectPermission([{ project: "hojo", level: "edit" }]);
}

export async function approveBbsAccount(id: number, staffId: number) {
  await requireHojoEditStaff();
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
  await requireHojoEditStaff();
  await prisma.hojoBbsAccount.update({
    where: { id },
    data: { status: "suspended" },
  });

  revalidatePath(REVALIDATE_PATH);
}

export async function reactivateBbsAccount(id: number) {
  await requireHojoEditStaff();
  await prisma.hojoBbsAccount.update({
    where: { id },
    data: { status: "active" },
  });

  revalidatePath(REVALIDATE_PATH);
}

export async function resetBbsPassword(id: number): Promise<string> {
  await requireHojoEditStaff();
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
  await requireHojoEditStaff();
  await prisma.hojoBbsAccount.delete({
    where: { id },
  });

  revalidatePath(REVALIDATE_PATH);
}
