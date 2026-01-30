"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

export async function addAgent(data: Record<string, unknown>) {
  // 次の代理店コードを取得
  const lastAgent = await prisma.stpAgent.findFirst({
    orderBy: { id: "desc" },
  });
  const nextId = (lastAgent?.id ?? 0) + 1;
  const agentCode = `SA-${nextId}`;

  await prisma.stpAgent.create({
    data: {
      agentCode,
      name: data.name as string,
      contactPerson: (data.contactPerson as string) || null,
      email: (data.email as string) || null,
      phone: (data.phone as string) || null,
      note: (data.note as string) || null,
      isActive: data.isActive === true || data.isActive === "true",
    },
  });
  revalidatePath("/stp/agents");
}

export async function updateAgent(id: number, data: Record<string, unknown>) {
  await prisma.stpAgent.update({
    where: { id },
    data: {
      name: data.name as string,
      contactPerson: (data.contactPerson as string) || null,
      email: (data.email as string) || null,
      phone: (data.phone as string) || null,
      note: (data.note as string) || null,
      isActive: data.isActive === true || data.isActive === "true",
    },
  });
  revalidatePath("/stp/agents");
}

export async function deleteAgent(id: number) {
  await prisma.stpAgent.delete({
    where: { id },
  });
  revalidatePath("/stp/agents");
}
