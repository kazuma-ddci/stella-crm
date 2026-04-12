"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireStaffWithProjectPermission } from "@/lib/auth/staff-action";

const REVALIDATE_PATH = "/hojo/security-cloud/accounts";

// このファイルの全関数は補助金プロジェクトの編集権限以上の社内スタッフのみ実行可能。
async function requireHojoEditStaff() {
  await requireStaffWithProjectPermission([{ project: "hojo", level: "edit" }]);
}

export async function updateWholesaleAccount(id: number, data: Record<string, unknown>) {
  await requireHojoEditStaff();
  const updateData: Record<string, unknown> = {};

  // 弊社側で編集可能なフィールドのみ
  if (data.accountApprovalDate !== undefined) {
    updateData.accountApprovalDate = data.accountApprovalDate ? new Date(String(data.accountApprovalDate)) : null;
  }
  if (data.toolCost !== undefined) {
    updateData.toolCost = data.toolCost ? Number(data.toolCost) : null;
  }
  if (data.invoiceStatus !== undefined) {
    updateData.invoiceStatus = data.invoiceStatus ? String(data.invoiceStatus).trim() : null;
  }

  if (Object.keys(updateData).length > 0) {
    await prisma.hojoWholesaleAccount.update({ where: { id }, data: updateData });
  }

  revalidatePath(REVALIDATE_PATH);
  revalidatePath("/hojo/vendor");
}

export async function deleteWholesaleAccount(id: number) {
  await requireHojoEditStaff();
  await prisma.hojoWholesaleAccount.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
  revalidatePath(REVALIDATE_PATH);
}

export async function restoreWholesaleAccount(id: number) {
  await requireHojoEditStaff();
  await prisma.hojoWholesaleAccount.update({
    where: { id },
    data: { deletedByVendor: false },
  });
  revalidatePath(REVALIDATE_PATH);
  revalidatePath("/hojo/vendor");
}
