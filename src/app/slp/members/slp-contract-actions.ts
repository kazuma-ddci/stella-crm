"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { recordStatusChangeIfNeeded } from "@/lib/contract-status/record-status-change";
import {
  generateContractNumber,
  getNextContractNumber as getNextNumber,
} from "@/lib/contracts/generate-number";
import { ok, err, type ActionResult } from "@/lib/action-result";
import { requireStaffWithProjectPermission } from "@/lib/auth/staff-action";

/**
 * SLPメンバーの契約書一覧を取得
 */
export async function getSlpMemberContracts(memberId: number) {
  // 閲覧目的なので SLP の view 以上で OK
  await requireStaffWithProjectPermission([{ project: "slp", level: "view" }]);
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
      contractFiles: true,
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
    cloudsignTitle: c.cloudsignTitle,
    cloudsignSentAt: c.cloudsignSentAt?.toISOString() ?? null,
    cloudsignCompletedAt: c.cloudsignCompletedAt?.toISOString() ?? null,
    cloudsignLastRemindedAt: c.cloudsignLastRemindedAt?.toISOString() ?? null,
    cloudsignInputData: c.cloudsignInputData as null | {
      capturedAt: string;
      documentId: string;
      widgets: Array<{
        label: string | null;
        text: string;
        widgetType: number;
        widgetTypeName: string;
        page: number;
        status: number;
        participantId: string;
        participantEmail: string | null;
      }>;
    },
    filePath: c.filePath,
    fileName: c.fileName,
    contractFiles: c.contractFiles.map((cf) => ({
      id: cf.id,
      filePath: cf.filePath,
      fileName: cf.fileName,
    })),
    note: c.note,
    createdAt: c.createdAt.toISOString(),
  }));
}

/**
 * 次の契約番号をプレビュー取得
 */
export async function getSlpNextContractNumber(): Promise<string> {
  await requireStaffWithProjectPermission([{ project: "slp", level: "view" }]);
  return getNextNumber();
}

type ContractFileInput = {
  id?: number;
  filePath?: string | null;
  fileName: string;
  fileSize?: number | null;
  mimeType?: string | null;
  url?: string | null;
};

type AddContractInput = {
  memberId: number;
  contractType: string;
  title: string;
  currentStatusId?: number | null;
  signingMethod?: string | null;
  signedDate?: string | null;
  note?: string | null;
  cloudsignDocumentId?: string | null;
  files?: ContractFileInput[];
};

/**
 * SLPメンバーに新規契約書を追加（契約番号自動生成）
 */
export async function addSlpMemberContract(
  input: AddContractInput
): Promise<ActionResult<{ contractId: number; contractNumber: string }>> {
  await requireStaffWithProjectPermission([{ project: "slp", level: "edit" }]);
  try {
    const slpProject = await prisma.masterProject.findFirst({
      where: { code: "slp" },
      select: { id: true },
    });
    if (!slpProject) return err("SLPプロジェクトが見つかりません");

    const contractNumber = await generateContractNumber();

    const contract = await prisma.masterContract.create({
      data: {
        projectId: slpProject.id,
        slpMemberId: input.memberId,
        contractNumber,
        contractType: input.contractType,
        title: input.title,
        currentStatusId: input.currentStatusId ?? null,
        signingMethod: input.signingMethod ?? "cloudsign",
        signedDate: input.signedDate ? new Date(input.signedDate) : null,
        note: input.note ?? null,
        cloudsignDocumentId: input.cloudsignDocumentId ?? null,
        contractFiles: input.files && input.files.length > 0
          ? {
              create: input.files.filter((f) => !f.id).map((f) => ({
                filePath: f.filePath ?? "",
                fileName: f.fileName,
                fileSize: f.fileSize ?? 0,
                mimeType: f.mimeType ?? "",
                category: "contract",
              })),
            }
          : undefined,
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
    return ok({ contractId: contract.id, contractNumber });
  } catch (e) {
    console.error("[addSlpMemberContract] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
}

type UpdateContractInput = {
  title?: string;
  currentStatusId?: number | null;
  signedDate?: string | null;
  signingMethod?: string | null;
  note?: string | null;
  cloudsignDocumentId?: string | null;
  files?: ContractFileInput[];
};

/**
 * 契約書を更新
 */
export async function updateSlpMemberContract(
  contractId: number,
  input: UpdateContractInput
): Promise<ActionResult> {
  await requireStaffWithProjectPermission([{ project: "slp", level: "edit" }]);
  try {
  const contract = await prisma.masterContract.findUnique({
    where: { id: contractId },
    select: { currentStatusId: true },
  });
  if (!contract) return err("契約書が見つかりません");

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

  // ファイル更新（既存のID以外を新規作成、不要なものを削除）
  if (input.files !== undefined) {
    const existingFiles = await prisma.contractFile.findMany({
      where: { contractId },
      select: { id: true },
    });
    const existingIds = existingFiles.map((f) => f.id);
    const inputIds = input.files.filter((f) => f.id).map((f) => f.id!);
    // 削除されたファイル
    const toDelete = existingIds.filter((id) => !inputIds.includes(id));
    if (toDelete.length > 0) {
      await prisma.contractFile.deleteMany({
        where: { id: { in: toDelete } },
      });
    }
    // 新規ファイル
    const toCreate = input.files.filter((f) => !f.id);
    if (toCreate.length > 0) {
      await prisma.contractFile.createMany({
        data: toCreate.map((f) => ({
          contractId,
          filePath: f.filePath ?? "",
          fileName: f.fileName,
          fileSize: f.fileSize ?? 0,
          mimeType: f.mimeType ?? "",
          category: "contract",
        })),
      });
    }
  }

  revalidatePath("/slp/members");
  revalidatePath("/slp/contracts");
  return ok();
  } catch (e) {
    console.error("[updateSlpMemberContract] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
}

/**
 * 契約書を削除（物理削除）
 */
export async function deleteSlpMemberContract(contractId: number): Promise<ActionResult> {
  await requireStaffWithProjectPermission([{ project: "slp", level: "edit" }]);
  try {
    // 関連する履歴も削除
    await prisma.masterContractStatusHistory.deleteMany({
      where: { contractId },
    });
    await prisma.masterContract.delete({ where: { id: contractId } });

    revalidatePath("/slp/members");
    revalidatePath("/slp/contracts");
    return ok();
  } catch (e) {
    console.error("[deleteSlpMemberContract] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
}
