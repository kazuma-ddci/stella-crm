"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { generateContractNumber } from "@/lib/contracts/generate-number";
import { recordContractCreation } from "./status-management/actions";
import { recordStatusChangeIfNeeded } from "@/lib/contract-status/record-status-change";

const STP_PROJECT_ID = 1;

export async function addContract(data: Record<string, unknown>) {
  // 契約番号を自動生成
  const contractNumber = await generateContractNumber();

  const contract = await prisma.masterContract.create({
    data: {
      companyId: Number(data.companyId),
      projectId: STP_PROJECT_ID,
      contractType: (data.contractType as string) || "",
      title: (data.title as string) || "",
      contractNumber,
      startDate: data.startDate ? new Date(data.startDate as string) : null,
      endDate: data.endDate ? new Date(data.endDate as string) : null,
      currentStatusId: data.currentStatusId ? Number(data.currentStatusId) : null,
      signedDate: data.signedDate ? new Date(data.signedDate as string) : null,
      signingMethod: (data.signingMethod as string) || null,
      filePath: (data.filePath as string) || null,
      fileName: (data.fileName as string) || null,
      assignedTo: (data.assignedTo as string) || null,
      note: (data.note as string) || null,
    },
  });

  // ステータスが設定されている場合は履歴を記録
  if (data.currentStatusId) {
    await recordContractCreation(
      contract.id,
      Number(data.currentStatusId)
    );
  }

  revalidatePath("/stp/contracts");
}

export async function updateContract(id: number, data: Record<string, unknown>) {
  const newStatusId = data.currentStatusId ? Number(data.currentStatusId) : null;

  // セッションからユーザー名を取得
  const session = await auth();
  const changedBy = session?.user?.name ?? null;

  // トランザクションで更新と履歴記録を実行
  await prisma.$transaction(async (tx) => {
    // 更新前のステータスを取得
    const currentContract = await tx.masterContract.findUnique({
      where: { id },
      select: { currentStatusId: true },
    });

    const currentStatusId = currentContract?.currentStatusId ?? null;

    // 契約書を更新
    await tx.masterContract.update({
      where: { id },
      data: {
        companyId: Number(data.companyId),
        contractType: (data.contractType as string) || "",
        title: (data.title as string) || "",
        contractNumber: (data.contractNumber as string) || null,
        startDate: data.startDate ? new Date(data.startDate as string) : null,
        endDate: data.endDate ? new Date(data.endDate as string) : null,
        currentStatusId: newStatusId,
        signedDate: data.signedDate ? new Date(data.signedDate as string) : null,
        signingMethod: (data.signingMethod as string) || null,
        filePath: (data.filePath as string) || null,
        fileName: (data.fileName as string) || null,
        assignedTo: (data.assignedTo as string) || null,
        note: (data.note as string) || null,
      },
    });

    // ステータスが変更された場合は履歴を記録
    await recordStatusChangeIfNeeded(
      tx,
      id,
      currentStatusId,
      newStatusId,
      changedBy ?? undefined
    );
  });

  revalidatePath("/stp/contracts");
}

export async function deleteContract(id: number) {
  await prisma.masterContract.delete({
    where: { id },
  });
  revalidatePath("/stp/contracts");
}
