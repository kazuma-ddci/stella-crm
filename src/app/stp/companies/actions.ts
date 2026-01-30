"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

export async function addStpCompany(data: Record<string, unknown>) {
  await prisma.stpCompany.create({
    data: {
      companyId: Number(data.companyId),
      note: (data.note as string) || null,
      leadAcquiredDate: data.leadAcquiredDate ? new Date(data.leadAcquiredDate as string) : null,
      meetingDate: data.meetingDate ? new Date(data.meetingDate as string) : null,
      currentStageId: data.currentStageId ? Number(data.currentStageId) : null,
      nextTargetStageId: data.nextTargetStageId ? Number(data.nextTargetStageId) : null,
      nextTargetDate: data.nextTargetDate ? new Date(data.nextTargetDate as string) : null,
      agentId: data.agentId ? Number(data.agentId) : null,
      assignedTo: (data.assignedTo as string) || null,
      priority: (data.priority as string) || null,
    },
  });
  revalidatePath("/stp/companies");
}

export async function updateStpCompany(id: number, data: Record<string, unknown>) {
  await prisma.stpCompany.update({
    where: { id },
    data: {
      companyId: Number(data.companyId),
      note: (data.note as string) || null,
      leadAcquiredDate: data.leadAcquiredDate ? new Date(data.leadAcquiredDate as string) : null,
      meetingDate: data.meetingDate ? new Date(data.meetingDate as string) : null,
      currentStageId: data.currentStageId ? Number(data.currentStageId) : null,
      nextTargetStageId: data.nextTargetStageId ? Number(data.nextTargetStageId) : null,
      nextTargetDate: data.nextTargetDate ? new Date(data.nextTargetDate as string) : null,
      agentId: data.agentId ? Number(data.agentId) : null,
      assignedTo: (data.assignedTo as string) || null,
      priority: (data.priority as string) || null,
    },
  });
  revalidatePath("/stp/companies");
}

export async function deleteStpCompany(id: number) {
  await prisma.stpCompany.delete({
    where: { id },
  });
  revalidatePath("/stp/companies");
}
