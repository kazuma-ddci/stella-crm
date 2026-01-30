"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

export async function addStageHistory(data: Record<string, unknown>) {
  await prisma.stpStageHistory.create({
    data: {
      stpCompanyId: Number(data.stpCompanyId),
      eventType: (data.eventType as string) || "manual",
      fromStageId: data.fromStageId ? Number(data.fromStageId) : null,
      toStageId: data.toStageId ? Number(data.toStageId) : null,
      targetDate: data.targetDate ? new Date(data.targetDate as string) : null,
      recordedAt: data.recordedAt ? new Date(data.recordedAt as string) : new Date(),
      changedBy: (data.changedBy as string) || null,
      note: (data.note as string) || null,
    },
  });
  revalidatePath("/stp/records/stage-histories");
}

export async function updateStageHistory(id: number, data: Record<string, unknown>) {
  await prisma.stpStageHistory.update({
    where: { id },
    data: {
      stpCompanyId: Number(data.stpCompanyId),
      eventType: (data.eventType as string) || "manual",
      fromStageId: data.fromStageId ? Number(data.fromStageId) : null,
      toStageId: data.toStageId ? Number(data.toStageId) : null,
      targetDate: data.targetDate ? new Date(data.targetDate as string) : null,
      recordedAt: data.recordedAt ? new Date(data.recordedAt as string) : new Date(),
      changedBy: (data.changedBy as string) || null,
      note: (data.note as string) || null,
    },
  });
  revalidatePath("/stp/records/stage-histories");
}

export async function deleteStageHistory(id: number) {
  await prisma.stpStageHistory.delete({
    where: { id },
  });
  revalidatePath("/stp/records/stage-histories");
}
