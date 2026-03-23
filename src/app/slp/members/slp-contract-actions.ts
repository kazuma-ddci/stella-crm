"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { recordStatusChangeIfNeeded } from "@/lib/contract-status/record-status-change";

/**
 * SLPメンバーの契約書一覧を取得
 */
export async function getSlpMemberContracts(memberId: number) {
  const slpProject = await prisma.masterProject.findFirst({
    where: { code: "slp" },
    select: { id: true },
  });
  if (!slpProject) return [];

  const contracts = await prisma.masterContract.findMany({
    where: {
      slpMemberId: memberId,
      projectId: slpProject.id,
    },
    include: {
      currentStatus: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return contracts.map((c) => ({
    id: c.id,
    contractType: c.contractType,
    title: c.title,
    contractNumber: c.contractNumber,
    currentStatusId: c.currentStatusId,
    currentStatusName: c.currentStatus?.name ?? null,
    currentStatusType: c.currentStatus?.statusType ?? null,
    signedDate: c.signedDate?.toISOString().split("T")[0] ?? null,
    signingMethod: c.signingMethod,
    cloudsignDocumentId: c.cloudsignDocumentId,
    cloudsignStatus: c.cloudsignStatus,
    cloudsignUrl: c.cloudsignUrl,
    cloudsignAutoSync: c.cloudsignAutoSync,
    cloudsignSentAt: c.cloudsignSentAt?.toISOString() ?? null,
    cloudsignLastRemindedAt: c.cloudsignLastRemindedAt?.toISOString() ?? null,
    filePath: c.filePath,
    fileName: c.fileName,
    note: c.note,
    createdAt: c.createdAt.toISOString(),
  }));
}

type AddContractInput = {
  memberId: number;
  contractType: string;
  title: string;
  currentStatusId?: number | null;
  signingMethod?: string | null;
  note?: string | null;
};

/**
 * SLPメンバーに新規契約書を追加
 */
export async function addSlpMemberContract(input: AddContractInput) {
  const slpProject = await prisma.masterProject.findFirst({
    where: { code: "slp" },
    select: { id: true },
  });
  if (!slpProject) throw new Error("SLPプロジェクトが見つかりません");

  const contract = await prisma.masterContract.create({
    data: {
      projectId: slpProject.id,
      slpMemberId: input.memberId,
      contractType: input.contractType,
      title: input.title,
      currentStatusId: input.currentStatusId ?? null,
      signingMethod: input.signingMethod ?? null,
      note: input.note ?? null,
    },
  });

  if (input.currentStatusId) {
    await recordStatusChangeIfNeeded(
      prisma,
      contract.id,
      null,
      input.currentStatusId,
      "手動作成"
    );
  }

  revalidatePath("/slp/members");
  revalidatePath("/slp/contracts");
  return contract.id;
}

type UpdateContractInput = {
  title?: string;
  currentStatusId?: number | null;
  signedDate?: string | null;
  signingMethod?: string | null;
  note?: string | null;
  cloudsignDocumentId?: string | null;
};

/**
 * 契約書を更新
 */
export async function updateSlpMemberContract(contractId: number, input: UpdateContractInput) {
  const contract = await prisma.masterContract.findUnique({
    where: { id: contractId },
    select: { currentStatusId: true },
  });
  if (!contract) throw new Error("契約書が見つかりません");

  const data: Record<string, unknown> = {};
  if (input.title !== undefined) data.title = input.title;
  if (input.signingMethod !== undefined) data.signingMethod = input.signingMethod;
  if (input.note !== undefined) data.note = input.note;
  if (input.cloudsignDocumentId !== undefined) data.cloudsignDocumentId = input.cloudsignDocumentId;
  if (input.signedDate !== undefined) {
    data.signedDate = input.signedDate ? new Date(input.signedDate) : null;
  }
  if (input.currentStatusId !== undefined) {
    data.currentStatusId = input.currentStatusId;

    // ステータス変更時の追加処理
    const newStatus = input.currentStatusId
      ? await prisma.masterContractStatus.findUnique({ where: { id: input.currentStatusId } })
      : null;

    if (newStatus?.statusType === "signed" && !input.signedDate) {
      data.signedDate = new Date();
    }

    if (input.currentStatusId !== contract.currentStatusId) {
      await recordStatusChangeIfNeeded(
        prisma,
        contractId,
        contract.currentStatusId,
        input.currentStatusId!,
        "手動変更"
      );
    }
  }

  if (Object.keys(data).length > 0) {
    await prisma.masterContract.update({ where: { id: contractId }, data });
  }

  revalidatePath("/slp/members");
  revalidatePath("/slp/contracts");
}

/**
 * 契約書を削除（物理削除）
 */
export async function deleteSlpMemberContract(contractId: number) {
  // 関連する履歴も削除
  await prisma.masterContractStatusHistory.deleteMany({
    where: { contractId },
  });
  await prisma.masterContract.delete({ where: { id: contractId } });

  revalidatePath("/slp/members");
  revalidatePath("/slp/contracts");
}
