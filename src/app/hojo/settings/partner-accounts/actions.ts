"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { requireStaffWithProjectPermission } from "@/lib/auth/staff-action";

const REVALIDATE_PATH = "/hojo/settings/partner-accounts";

// このファイルの全関数は補助金プロジェクトの編集権限以上の社内スタッフのみ実行可能。
// 各関数の先頭で requireStaffWithProjectPermission を呼ぶ(throw 形式なので
// try/catch なし、呼び出し元の client が catch する想定)。
async function requireHojoEditStaff() {
  await requireStaffWithProjectPermission([{ project: "hojo", level: "edit" }]);
}

// ========== BBS アカウント ==========

export async function approveBbsAccount(id: number, staffId: number) {
  await requireHojoEditStaff();
  await prisma.hojoBbsAccount.update({
    where: { id },
    data: { status: "active", approvedAt: new Date(), approvedBy: staffId },
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
  const initialPassword = crypto.randomBytes(4).toString("hex");
  const passwordHash = await bcrypt.hash(initialPassword, 12);
  await prisma.hojoBbsAccount.update({
    where: { id },
    data: { passwordHash, mustChangePassword: true, passwordResetRequestedAt: null },
  });
  revalidatePath(REVALIDATE_PATH);
  return initialPassword;
}

export async function deleteBbsAccount(id: number) {
  await requireHojoEditStaff();
  await prisma.hojoBbsAccount.delete({ where: { id } });
  revalidatePath(REVALIDATE_PATH);
}

// ========== ベンダー アカウント ==========

export async function approveVendorAccount(id: number, staffId: number) {
  await requireHojoEditStaff();
  await prisma.hojoVendorAccount.update({
    where: { id },
    data: { status: "active", approvedAt: new Date(), approvedBy: staffId },
  });
  revalidatePath(REVALIDATE_PATH);
}

export async function suspendVendorAccount(id: number) {
  await requireHojoEditStaff();
  await prisma.hojoVendorAccount.update({
    where: { id },
    data: { status: "suspended" },
  });
  revalidatePath(REVALIDATE_PATH);
}

export async function reactivateVendorAccount(id: number) {
  await requireHojoEditStaff();
  await prisma.hojoVendorAccount.update({
    where: { id },
    data: { status: "active" },
  });
  revalidatePath(REVALIDATE_PATH);
}

export async function resetVendorPassword(id: number): Promise<string> {
  await requireHojoEditStaff();
  const initialPassword = crypto.randomBytes(4).toString("hex");
  const passwordHash = await bcrypt.hash(initialPassword, 12);
  await prisma.hojoVendorAccount.update({
    where: { id },
    data: { passwordHash, mustChangePassword: true, passwordResetRequestedAt: null },
  });
  revalidatePath(REVALIDATE_PATH);
  return initialPassword;
}

export async function deleteVendorAccount(id: number) {
  await requireHojoEditStaff();
  await prisma.hojoVendorAccount.delete({ where: { id } });
  revalidatePath(REVALIDATE_PATH);
}

// ========== 貸金業社 アカウント ==========

export async function approveLenderAccount(id: number, staffId: number) {
  await requireHojoEditStaff();
  await prisma.hojoLenderAccount.update({
    where: { id },
    data: { status: "active", approvedAt: new Date(), approvedBy: staffId },
  });
  revalidatePath(REVALIDATE_PATH);
}

export async function suspendLenderAccount(id: number) {
  await requireHojoEditStaff();
  await prisma.hojoLenderAccount.update({
    where: { id },
    data: { status: "suspended" },
  });
  revalidatePath(REVALIDATE_PATH);
}

export async function reactivateLenderAccount(id: number) {
  await requireHojoEditStaff();
  await prisma.hojoLenderAccount.update({
    where: { id },
    data: { status: "active" },
  });
  revalidatePath(REVALIDATE_PATH);
}

export async function resetLenderPassword(id: number): Promise<string> {
  await requireHojoEditStaff();
  const initialPassword = crypto.randomBytes(4).toString("hex");
  const passwordHash = await bcrypt.hash(initialPassword, 12);
  await prisma.hojoLenderAccount.update({
    where: { id },
    data: { passwordHash, mustChangePassword: true, passwordResetRequestedAt: null },
  });
  revalidatePath(REVALIDATE_PATH);
  return initialPassword;
}

export async function deleteLenderAccount(id: number) {
  await requireHojoEditStaff();
  await prisma.hojoLenderAccount.delete({ where: { id } });
  revalidatePath(REVALIDATE_PATH);
}
