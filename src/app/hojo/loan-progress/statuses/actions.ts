"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { ok, err, type ActionResult } from "@/lib/action-result";

export async function addLoanProgressStatus(name: string): Promise<ActionResult> {
  try {
    const maxOrder = await prisma.hojoLoanProgressStatus.aggregate({
      _max: { displayOrder: true },
    });
    await prisma.hojoLoanProgressStatus.create({
      data: { name, displayOrder: (maxOrder._max.displayOrder ?? 0) + 1 },
    });
    revalidatePath("/hojo/loan-progress/statuses");
    return ok();
  } catch (e) {
    console.error("[addLoanProgressStatus] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
}

export async function updateLoanProgressStatus(
  id: number,
  data: { name?: string; displayOrder?: number; isActive?: boolean }
): Promise<ActionResult> {
  try {
    await prisma.hojoLoanProgressStatus.update({ where: { id }, data });
    revalidatePath("/hojo/loan-progress/statuses");
    revalidatePath("/hojo/loan-progress");
    return ok();
  } catch (e) {
    console.error("[updateLoanProgressStatus] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
}

export async function deleteLoanProgressStatus(id: number): Promise<ActionResult> {
  try {
    const count = await prisma.hojoLoanProgress.count({
      where: { statusId: id },
    });
    if (count > 0) return err("使用中のステータスは削除できません");
    await prisma.hojoLoanProgressStatus.delete({ where: { id } });
    revalidatePath("/hojo/loan-progress/statuses");
    return ok();
  } catch (e) {
    console.error("[deleteLoanProgressStatus] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
}
