"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireStaffWithProjectPermission } from "@/lib/auth/staff-action";

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
  // 認証: STPプロジェクトの編集権限以上
  // 注: getSession() の redirect を伝播させるため try/catch の外で呼ぶ
  await requireStaffWithProjectPermission([{ project: "stp", level: "edit" }]);
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
  await requireStaffWithProjectPermission([{ project: "stp", level: "edit" }]);
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
  await requireStaffWithProjectPermission([{ project: "stp", level: "edit" }]);
  await prisma.stpAgentContract.delete({
    where: { id },
  });

  revalidatePath("/stp/agents");
}

export async function getContracts(agentId: number) {
  await requireStaffWithProjectPermission([{ project: "stp", level: "view" }]);
  const contracts = await prisma.stpAgentContract.findMany({
    where: { agentId },
    orderBy: { createdAt: "desc" },
  });

  return contracts.map((contract) => ({
    id: contract.id,
    contractUrl: contract.contractUrl,
    signedDate: contract.signedDate?.toISOString() || null,
    title: contract.title,
    externalId: contract.externalId,
    externalService: contract.externalService,
    status: contract.status,
    note: contract.note,
  }));
}
