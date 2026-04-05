"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function addLoanProgressStatus(name: string) {
  const maxOrder = await prisma.hojoLoanProgressStatus.aggregate({
    _max: { displayOrder: true },
  });
  await prisma.hojoLoanProgressStatus.create({
    data: { name, displayOrder: (maxOrder._max.displayOrder ?? 0) + 1 },
  });
  revalidatePath("/hojo/loan-progress/statuses");
}

export async function updateLoanProgressStatus(
  id: number,
  data: { name?: string; displayOrder?: number; isActive?: boolean }
) {
  await prisma.hojoLoanProgressStatus.update({ where: { id }, data });
  revalidatePath("/hojo/loan-progress/statuses");
  revalidatePath("/hojo/loan-progress");
}

export async function deleteLoanProgressStatus(id: number) {
  const count = await prisma.hojoLoanProgress.count({
    where: { statusId: id },
  });
  if (count > 0) throw new Error("使用中のステータスは削除できません");
  await prisma.hojoLoanProgressStatus.delete({ where: { id } });
  revalidatePath("/hojo/loan-progress/statuses");
}
