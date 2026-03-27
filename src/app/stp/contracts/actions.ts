"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { requireEdit } from "@/lib/auth";
import { generateContractNumber } from "@/lib/contracts/generate-number";
import { recordContractCreation } from "./status-management/actions";
import { recordStatusChangeIfNeeded } from "@/lib/contract-status/record-status-change";
import { logActivity } from "@/lib/activity-log/log";
import { calcChanges } from "@/lib/activity-log/utils";

const STP_PROJECT_ID = 1;

export async function addContract(data: Record<string, unknown>) {
  const user = await requireEdit("stp");
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

  await logActivity({ model: "MasterContract", recordId: contract.id, action: "create", summary: `契約書「${(data.title as string) || ""}」を作成`, userId: user.id });
  revalidatePath("/stp/contracts");
}

export async function updateContract(id: number, data: Record<string, unknown>) {
  const user = await requireEdit("stp");

  // 変更前データを取得（差分記録用）
  const oldRecord = await prisma.masterContract.findUnique({ where: { id } });

  // 差分更新用データの構築（渡されたフィールドのみ）
  const updateData: Record<string, unknown> = {};
  if ("companyId" in data) updateData.companyId = Number(data.companyId);
  if ("contractType" in data) updateData.contractType = (data.contractType as string) || "";
  if ("title" in data) updateData.title = (data.title as string) || "";
  if ("contractNumber" in data) updateData.contractNumber = (data.contractNumber as string) || null;
  if ("startDate" in data) updateData.startDate = data.startDate ? new Date(data.startDate as string) : null;
  if ("endDate" in data) updateData.endDate = data.endDate ? new Date(data.endDate as string) : null;
  if ("currentStatusId" in data) updateData.currentStatusId = data.currentStatusId ? Number(data.currentStatusId) : null;
  if ("signedDate" in data) updateData.signedDate = data.signedDate ? new Date(data.signedDate as string) : null;
  if ("signingMethod" in data) updateData.signingMethod = (data.signingMethod as string) || null;
  if ("filePath" in data) updateData.filePath = (data.filePath as string) || null;
  if ("fileName" in data) updateData.fileName = (data.fileName as string) || null;
  if ("assignedTo" in data) updateData.assignedTo = (data.assignedTo as string) || null;
  if ("note" in data) updateData.note = (data.note as string) || null;

  const hasStatusChange = "currentStatusId" in data;

  if (hasStatusChange) {
    const newStatusId = data.currentStatusId ? Number(data.currentStatusId) : null;

    // セッションからユーザー名を取得
    const session = await auth();
    const changedBy = session?.user?.name ?? null;

    // トランザクションで更新と履歴記録を実行
    await prisma.$transaction(async (tx) => {
      const currentContract = await tx.masterContract.findUnique({
        where: { id },
        select: { currentStatusId: true },
      });
      const currentStatusId = currentContract?.currentStatusId ?? null;

      if (Object.keys(updateData).length > 0) {
        await tx.masterContract.update({
          where: { id },
          data: updateData,
        });
      }

      await recordStatusChangeIfNeeded(
        tx,
        id,
        currentStatusId,
        newStatusId,
        changedBy ?? undefined
      );
    });
  } else if (Object.keys(updateData).length > 0) {
    await prisma.masterContract.update({
      where: { id },
      data: updateData,
    });
  }

  const fieldLabels: Record<string, string> = {
    companyId: "取引先", contractType: "契約種別", title: "契約書名",
    contractNumber: "契約番号", startDate: "開始日", endDate: "終了日",
    currentStatusId: "ステータス", signedDate: "締結日", signingMethod: "締結方法",
    assignedTo: "担当者", note: "備考",
  };
  const changes = oldRecord ? calcChanges(oldRecord as unknown as Record<string, unknown>, updateData, fieldLabels) : null;
  await logActivity({ model: "MasterContract", recordId: id, action: "update", summary: `契約書「${oldRecord?.title || ""}」を更新`, changes, userId: user.id });
  revalidatePath("/stp/contracts");
}

export async function deleteContract(id: number) {
  const user = await requireEdit("stp");
  const contract = await prisma.masterContract.findUnique({ where: { id }, select: { title: true } });
  await logActivity({ model: "MasterContract", recordId: id, action: "delete", summary: `契約書「${contract?.title || ""}」を削除`, userId: user.id });
  await prisma.masterContract.delete({
    where: { id },
  });
  revalidatePath("/stp/contracts");
}
