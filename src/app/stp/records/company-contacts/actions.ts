"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

export async function addCompanyContact(data: Record<string, unknown>) {
  await prisma.stpContactHistory.create({
    data: {
      stpCompanyId: data.stpCompanyId ? Number(data.stpCompanyId) : null,
      agentId: null,
      contactDate: new Date(data.contactDate as string),
      contactMethodId: data.contactMethodId ? Number(data.contactMethodId) : null,
      assignedTo: (data.assignedTo as string) || null,
      meetingMinutes: (data.meetingMinutes as string) || null,
      note: (data.note as string) || null,
    },
  });
  revalidatePath("/stp/records/company-contacts");
}

export async function updateCompanyContact(id: number, data: Record<string, unknown>) {
  await prisma.stpContactHistory.update({
    where: { id },
    data: {
      stpCompanyId: data.stpCompanyId ? Number(data.stpCompanyId) : null,
      contactDate: new Date(data.contactDate as string),
      contactMethodId: data.contactMethodId ? Number(data.contactMethodId) : null,
      assignedTo: (data.assignedTo as string) || null,
      meetingMinutes: (data.meetingMinutes as string) || null,
      note: (data.note as string) || null,
    },
  });
  revalidatePath("/stp/records/company-contacts");
}

export async function deleteCompanyContact(id: number) {
  await prisma.stpContactHistory.delete({
    where: { id },
  });
  revalidatePath("/stp/records/company-contacts");
}
