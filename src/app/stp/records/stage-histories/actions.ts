"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireEdit } from "@/lib/auth";

export async function addStageHistory(data: Record<string, unknown>) {
  await requireEdit("stp");
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
  await requireEdit("stp");
  const updateData: Record<string, unknown> = {};
  if ("stpCompanyId" in data) updateData.stpCompanyId = Number(data.stpCompanyId);
  if ("eventType" in data) updateData.eventType = (data.eventType as string) || "manual";
  if ("fromStageId" in data) updateData.fromStageId = data.fromStageId ? Number(data.fromStageId) : null;
  if ("toStageId" in data) updateData.toStageId = data.toStageId ? Number(data.toStageId) : null;
  if ("targetDate" in data) updateData.targetDate = data.targetDate ? new Date(data.targetDate as string) : null;
  if ("recordedAt" in data) updateData.recordedAt = data.recordedAt ? new Date(data.recordedAt as string) : new Date();
  if ("changedBy" in data) updateData.changedBy = (data.changedBy as string) || null;
  if ("note" in data) updateData.note = (data.note as string) || null;

  if (Object.keys(updateData).length > 0) {
    await prisma.stpStageHistory.update({
      where: { id },
      data: updateData,
    });
  }
  revalidatePath("/stp/records/stage-histories");
}

export async function deleteStageHistory(id: number) {
  await requireEdit("stp");
  await prisma.stpStageHistory.delete({
    where: { id },
  });
  revalidatePath("/stp/records/stage-histories");
}
