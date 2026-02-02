"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

const STP_PROJECT_ID = 1;

export async function addContract(data: Record<string, unknown>) {
  await prisma.masterContract.create({
    data: {
      companyId: Number(data.companyId),
      projectId: STP_PROJECT_ID,
      contractType: (data.contractType as string) || "",
      title: (data.title as string) || "",
      contractNumber: (data.contractNumber as string) || null,
      startDate: data.startDate ? new Date(data.startDate as string) : null,
      endDate: data.endDate ? new Date(data.endDate as string) : null,
      currentStatusId: data.currentStatusId ? Number(data.currentStatusId) : null,
      targetDate: data.targetDate ? new Date(data.targetDate as string) : null,
      signedDate: data.signedDate ? new Date(data.signedDate as string) : null,
      signingMethod: (data.signingMethod as string) || null,
      filePath: (data.filePath as string) || null,
      fileName: (data.fileName as string) || null,
      assignedTo: (data.assignedTo as string) || null,
      note: (data.note as string) || null,
    },
  });
  revalidatePath("/stp/contracts");
}

export async function updateContract(id: number, data: Record<string, unknown>) {
  await prisma.masterContract.update({
    where: { id },
    data: {
      companyId: Number(data.companyId),
      contractType: (data.contractType as string) || "",
      title: (data.title as string) || "",
      contractNumber: (data.contractNumber as string) || null,
      startDate: data.startDate ? new Date(data.startDate as string) : null,
      endDate: data.endDate ? new Date(data.endDate as string) : null,
      currentStatusId: data.currentStatusId ? Number(data.currentStatusId) : null,
      targetDate: data.targetDate ? new Date(data.targetDate as string) : null,
      signedDate: data.signedDate ? new Date(data.signedDate as string) : null,
      signingMethod: (data.signingMethod as string) || null,
      filePath: (data.filePath as string) || null,
      fileName: (data.fileName as string) || null,
      assignedTo: (data.assignedTo as string) || null,
      note: (data.note as string) || null,
    },
  });
  revalidatePath("/stp/contracts");
}

export async function deleteContract(id: number) {
  await prisma.masterContract.delete({
    where: { id },
  });
  revalidatePath("/stp/contracts");
}
