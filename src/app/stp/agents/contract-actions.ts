"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

type ContractInput = {
  contractUrl?: string;
  signedDate?: string | null;
  title?: string | null;
  externalId?: string | null;
  externalService?: string | null;
  status?: string;
  note?: string | null;
};

export async function addContract(
  agentId: number,
  data: ContractInput
) {
  const contract = await prisma.stpAgentContract.create({
    data: {
      agentId,
      contractUrl: data.contractUrl!,
      signedDate: data.signedDate ? new Date(data.signedDate) : null,
      title: data.title || null,
      externalId: data.externalId || null,
      externalService: data.externalService || null,
      status: data.status || "signed",
      note: data.note || null,
    },
  });

  revalidatePath("/stp/agents");

  return {
    id: contract.id,
    contractUrl: contract.contractUrl,
    signedDate: contract.signedDate?.toISOString() || null,
    title: contract.title,
    externalId: contract.externalId,
    externalService: contract.externalService,
    status: contract.status,
    note: contract.note,
  };
}

export async function updateContract(
  id: number,
  data: ContractInput
) {
  const contract = await prisma.stpAgentContract.update({
    where: { id },
    data: {
      contractUrl: data.contractUrl!,
      signedDate: data.signedDate ? new Date(data.signedDate) : null,
      title: data.title || null,
      externalId: data.externalId || null,
      externalService: data.externalService || null,
      status: data.status || "signed",
      note: data.note || null,
    },
  });

  revalidatePath("/stp/agents");

  return {
    id: contract.id,
    contractUrl: contract.contractUrl,
    signedDate: contract.signedDate?.toISOString() || null,
    title: contract.title,
    externalId: contract.externalId,
    externalService: contract.externalService,
    status: contract.status,
    note: contract.note,
  };
}

export async function deleteContract(id: number) {
  await prisma.stpAgentContract.delete({
    where: { id },
  });

  revalidatePath("/stp/agents");
}
