"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

export async function addAgentContact(data: Record<string, unknown>) {
  await prisma.stpContactHistory.create({
    data: {
      stpCompanyId: null,
      agentId: data.agentId ? Number(data.agentId) : null,
      contactDate: new Date(data.contactDate as string),
      contactMethodId: data.contactMethodId ? Number(data.contactMethodId) : null,
      assignedTo: (data.assignedTo as string) || null,
      meetingMinutes: (data.meetingMinutes as string) || null,
      note: (data.note as string) || null,
    },
  });
  revalidatePath("/stp/records/agent-contacts");
}

export async function updateAgentContact(id: number, data: Record<string, unknown>) {
  await prisma.stpContactHistory.update({
    where: { id },
    data: {
      agentId: data.agentId ? Number(data.agentId) : null,
      contactDate: new Date(data.contactDate as string),
      contactMethodId: data.contactMethodId ? Number(data.contactMethodId) : null,
      assignedTo: (data.assignedTo as string) || null,
      meetingMinutes: (data.meetingMinutes as string) || null,
      note: (data.note as string) || null,
    },
  });
  revalidatePath("/stp/records/agent-contacts");
}

export async function deleteAgentContact(id: number) {
  await prisma.stpContactHistory.delete({
    where: { id },
  });
  revalidatePath("/stp/records/agent-contacts");
}
