"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

const REVALIDATE_PATH = "/hojo/security-cloud/accounts";

export async function updateWholesaleAccount(id: number, data: Record<string, unknown>) {
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
  await prisma.hojoWholesaleAccount.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
  revalidatePath(REVALIDATE_PATH);
}

export async function restoreWholesaleAccount(id: number) {
  await prisma.hojoWholesaleAccount.update({
    where: { id },
    data: { deletedByVendor: false },
  });
  revalidatePath(REVALIDATE_PATH);
  revalidatePath("/hojo/vendor");
}
