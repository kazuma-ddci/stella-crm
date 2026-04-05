"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import crypto from "crypto";

const REVALIDATE_PATH = "/hojo/settings/partner-accounts";

// ========== BBS アカウント ==========

export async function approveBbsAccount(id: number, staffId: number) {
  await prisma.hojoBbsAccount.update({
    where: { id },
    data: { status: "active", approvedAt: new Date(), approvedBy: staffId },
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
  await prisma.hojoBbsAccount.delete({ where: { id } });
  revalidatePath(REVALIDATE_PATH);
}

// ========== ベンダー アカウント ==========

export async function approveVendorAccount(id: number, staffId: number) {
  await prisma.hojoVendorAccount.update({
    where: { id },
    data: { status: "active", approvedAt: new Date(), approvedBy: staffId },
  });
  revalidatePath(REVALIDATE_PATH);
}

export async function suspendVendorAccount(id: number) {
  await prisma.hojoVendorAccount.update({
    where: { id },
    data: { status: "suspended" },
  });
  revalidatePath(REVALIDATE_PATH);
}

export async function reactivateVendorAccount(id: number) {
  await prisma.hojoVendorAccount.update({
    where: { id },
    data: { status: "active" },
  });
  revalidatePath(REVALIDATE_PATH);
}

export async function resetVendorPassword(id: number): Promise<string> {
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
  await prisma.hojoVendorAccount.delete({ where: { id } });
  revalidatePath(REVALIDATE_PATH);
}

// ========== 貸金業社 アカウント ==========

export async function approveLenderAccount(id: number, staffId: number) {
  await prisma.hojoLenderAccount.update({
    where: { id },
    data: { status: "active", approvedAt: new Date(), approvedBy: staffId },
  });
  revalidatePath(REVALIDATE_PATH);
}

export async function suspendLenderAccount(id: number) {
  await prisma.hojoLenderAccount.update({
    where: { id },
    data: { status: "suspended" },
  });
  revalidatePath(REVALIDATE_PATH);
}

export async function reactivateLenderAccount(id: number) {
  await prisma.hojoLenderAccount.update({
    where: { id },
    data: { status: "active" },
  });
  revalidatePath(REVALIDATE_PATH);
}

export async function resetLenderPassword(id: number): Promise<string> {
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
  await prisma.hojoLenderAccount.delete({ where: { id } });
  revalidatePath(REVALIDATE_PATH);
}
