"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import {
  generateContractNumber,
  getNextContractNumber as getNextNumber,
} from "@/lib/contracts/generate-number";
import {
  recordStatusChangeIfNeeded,
  recordContractCreationInTx,
} from "@/lib/contract-status/record-status-change";

const STP_PROJECT_ID = 1; // 採用ブースト

type ContractFileInput = {
  id?: number;
  filePath: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
};

type ContractInput = {
  contractType: string;
  title: string;
  startDate?: string | null;
  endDate?: string | null;
  currentStatusId?: number | null;
  signedDate?: string | null;
  signingMethod?: string | null;
  filePath?: string | null;
  fileName?: string | null;
  assignedTo?: string | null;
  note?: string | null;
  cloudsignDocumentId?: string | null;
  parentContractId?: number | null;
  files?: ContractFileInput[];
};

/**
 * 次の契約番号をプレビュー取得（保存前に表示用）
 */
export async function getNextContractNumber(): Promise<string> {
  return getNextNumber();
}

/**
 * 企業の契約書一覧を取得
 * @param companyId MasterStellaCompanyのID
 */
export async function getMasterContracts(companyId: number) {
  const contracts = await prisma.masterContract.findMany({
    where: {
      companyId,
      projectId: STP_PROJECT_ID,
    },
    include: {
      currentStatus: true,
      parentContract: {
        select: { id: true, contractNumber: true, title: true, contractType: true },
      },
      contractFiles: {
        where: { isVisible: true },
        orderBy: { createdAt: "asc" },
      },
      contractHistories: {
        where: { deletedAt: null },
        include: {
          salesStaff: { select: { id: true, name: true } },
          operationStaff: { select: { id: true, name: true } },
        },
        orderBy: { contractStartDate: "desc" },
      },
      agentContractHistories: {
        where: { deletedAt: null },
        orderBy: { contractStartDate: "desc" },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  // cloudsignStatusMapping → CRMステータス名の逆引きマップを構築
  const statusMaster = await prisma.masterContractStatus.findMany({
    where: { isActive: true, cloudsignStatusMapping: { not: null } },
    select: { name: true, cloudsignStatusMapping: true },
  });
  const csStatusToName = new Map<string, string>();
  for (const s of statusMaster) {
    if (s.cloudsignStatusMapping) {
      csStatusToName.set(s.cloudsignStatusMapping, s.name);
    }
  }

  return contracts.map((c) => ({
    id: c.id,
    contractType: c.contractType,
    title: c.title,
    contractNumber: c.contractNumber,
    startDate: c.startDate?.toISOString() || null,
    endDate: c.endDate?.toISOString() || null,
    currentStatusId: c.currentStatusId,
    currentStatusName: c.currentStatus?.name || null,
    signedDate: c.signedDate?.toISOString() || null,
    signingMethod: c.signingMethod,
    filePath: c.filePath,
    fileName: c.fileName,
    assignedTo: c.assignedTo,
    note: c.note,
    cloudsignDocumentId: c.cloudsignDocumentId,
    cloudsignStatus: c.cloudsignStatus,
    cloudsignUrl: c.cloudsignUrl,
    cloudsignAutoSync: c.cloudsignAutoSync,
    cloudsignTitle: c.cloudsignTitle,
    cloudsignLastRemindedAt: c.cloudsignLastRemindedAt?.toISOString() || null,
    cloudsignExpectedStatusName: c.cloudsignStatus
      ? csStatusToName.get(c.cloudsignStatus) || null
      : null,
    cloudsignSelfSigningEmailId: c.cloudsignSelfSigningEmailId,
    cloudsignSelfSignedAt: c.cloudsignSelfSignedAt?.toISOString() || null,
    cloudsignSelfSigningUrl: c.cloudsignSelfSigningUrl,
    contractFiles: c.contractFiles.map((cf) => ({
      id: cf.id,
      filePath: cf.filePath,
      fileName: cf.fileName,
      fileSize: cf.fileSize,
      mimeType: cf.mimeType,
      category: cf.category,
    })),
    parentContractId: c.parentContractId,
    parentContract: c.parentContract
      ? {
          id: c.parentContract.id,
          contractNumber: c.parentContract.contractNumber,
          title: c.parentContract.title,
          contractType: c.parentContract.contractType,
        }
      : null,
    contractHistories: c.contractHistories.map((ch) => ({
      id: ch.id,
      industryType: ch.industryType,
      contractPlan: ch.contractPlan,
      jobMedia: ch.jobMedia,
      contractStartDate: ch.contractStartDate.toISOString(),
      contractEndDate: ch.contractEndDate?.toISOString() || null,
      initialFee: ch.initialFee,
      monthlyFee: ch.monthlyFee,
      performanceFee: ch.performanceFee,
      salesStaffId: ch.salesStaffId,
      salesStaffName: ch.salesStaff?.name || null,
      operationStaffId: ch.operationStaffId,
      operationStaffName: ch.operationStaff?.name || null,
      status: ch.status,
      operationStatus: ch.operationStatus,
      accountId: ch.accountId,
      accountPass: ch.accountPass,
      note: ch.note,
      masterContractId: ch.masterContractId,
      contractDate: ch.contractDate?.toISOString() || null,
    })),
    agentContractHistories: c.agentContractHistories.map((ah) => ({
      id: ah.id,
      agentId: ah.agentId,
      contractStartDate: ah.contractStartDate.toISOString(),
      contractEndDate: ah.contractEndDate?.toISOString() || null,
      contractDate: ah.contractDate?.toISOString() || null,
      status: ah.status,
      initialFee: ah.initialFee,
      monthlyFee: ah.monthlyFee,
      defaultMpInitialType: ah.defaultMpInitialType,
      defaultMpInitialRate: ah.defaultMpInitialRate ? Number(ah.defaultMpInitialRate) : null,
      defaultMpInitialFixed: ah.defaultMpInitialFixed,
      defaultMpInitialDuration: ah.defaultMpInitialDuration,
      defaultMpMonthlyType: ah.defaultMpMonthlyType,
      defaultMpMonthlyRate: ah.defaultMpMonthlyRate ? Number(ah.defaultMpMonthlyRate) : null,
      defaultMpMonthlyFixed: ah.defaultMpMonthlyFixed,
      defaultMpMonthlyDuration: ah.defaultMpMonthlyDuration,
      defaultPpInitialType: ah.defaultPpInitialType,
      defaultPpInitialRate: ah.defaultPpInitialRate ? Number(ah.defaultPpInitialRate) : null,
      defaultPpInitialFixed: ah.defaultPpInitialFixed,
      defaultPpInitialDuration: ah.defaultPpInitialDuration,
      defaultPpPerfType: ah.defaultPpPerfType,
      defaultPpPerfRate: ah.defaultPpPerfRate ? Number(ah.defaultPpPerfRate) : null,
      defaultPpPerfFixed: ah.defaultPpPerfFixed,
      defaultPpPerfDuration: ah.defaultPpPerfDuration,
      note: ah.note,
      masterContractId: ah.masterContractId,
    })),
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  }));
}

/**
 * 契約書を追加
 * @param companyId MasterStellaCompanyのID
 * @param data 契約書データ
 * @returns 作成された契約番号
 */
export async function addMasterContract(companyId: number, data: ContractInput): Promise<{ contractNumber: string; contractId: number }> {
  // 契約番号を自動生成
  const contractNumber = await generateContractNumber();

  // セッションからユーザー名を取得
  const session = await auth();
  const changedBy = session?.user?.name ?? null;

  // トランザクションで作成と履歴記録を実行
  const result = await prisma.$transaction(async (tx) => {
    const contract = await tx.masterContract.create({
      data: {
        companyId,
        projectId: STP_PROJECT_ID,
        contractNumber,
        contractType: data.contractType,
        title: data.title,
        startDate: data.startDate ? new Date(data.startDate) : null,
        endDate: data.endDate ? new Date(data.endDate) : null,
        currentStatusId: data.currentStatusId || null,
        signedDate: data.signedDate ? new Date(data.signedDate) : null,
        signingMethod: data.signingMethod || null,
        filePath: data.filePath || null,
        fileName: data.fileName || null,
        assignedTo: data.assignedTo || null,
        note: data.note || null,
        parentContractId: data.parentContractId || null,
      },
    });

    // 契約ファイルを保存
    if (data.files && data.files.length > 0) {
      await tx.contractFile.createMany({
        data: data.files.map((f) => ({
          contractId: contract.id,
          filePath: f.filePath,
          fileName: f.fileName,
          fileSize: f.fileSize,
          mimeType: f.mimeType,
          category: "other",
          uploadedBy: changedBy,
        })),
      });
    }

    // ステータスが設定されている場合は履歴を記録
    if (data.currentStatusId) {
      await recordContractCreationInTx(
        tx,
        contract.id,
        data.currentStatusId,
        changedBy ?? undefined
      );
    }

    return contract;
  });

  revalidatePath("/stp/companies", "layout");
  revalidatePath("/stp/agents");
  revalidatePath("/stp/contracts");

  return { contractNumber, contractId: result.id };
}

/**
 * 契約書を更新
 * @param id 契約書ID
 * @param data 契約書データ
 */
export async function updateMasterContract(id: number, data: ContractInput) {
  const newStatusId = data.currentStatusId || null;

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
        contractType: data.contractType,
        title: data.title,
        startDate: data.startDate ? new Date(data.startDate) : null,
        endDate: data.endDate ? new Date(data.endDate) : null,
        currentStatusId: newStatusId,
        signedDate: data.signedDate ? new Date(data.signedDate) : null,
        signingMethod: data.signingMethod || null,
        filePath: data.filePath || null,
        fileName: data.fileName || null,
        assignedTo: data.assignedTo || null,
        note: data.note || null,
        parentContractId: data.parentContractId || null,
      },
    });

    // 契約ファイルを更新（replace方式: 既存を削除して新規作成）
    if (data.files !== undefined) {
      // 手動アップロード分のみ削除（category="other"）
      await tx.contractFile.deleteMany({
        where: { contractId: id, category: "other" },
      });
      if (data.files.length > 0) {
        await tx.contractFile.createMany({
          data: data.files.map((f) => ({
            contractId: id,
            filePath: f.filePath,
            fileName: f.fileName,
            fileSize: f.fileSize,
            mimeType: f.mimeType,
            category: "other",
            uploadedBy: changedBy,
          })),
        });
      }
    }

    // ステータスが変更された場合は履歴を記録
    await recordStatusChangeIfNeeded(
      tx,
      id,
      currentStatusId,
      newStatusId,
      changedBy ?? undefined
    );
  });

  revalidatePath("/stp/companies", "layout");
  revalidatePath("/stp/agents");
  revalidatePath("/stp/contracts");
}

/**
 * 契約書を削除
 * @param id 契約書ID
 */
export async function deleteMasterContract(id: number) {
  await prisma.masterContract.delete({
    where: { id },
  });

  revalidatePath("/stp/companies", "layout");
  revalidatePath("/stp/agents");
  revalidatePath("/stp/contracts");
}

/**
 * 契約書ステータス一覧を取得
 */
export async function getMasterContractStatuses() {
  const statuses = await prisma.masterContractStatus.findMany({
    where: { isActive: true },
    orderBy: { displayOrder: "asc" },
  });

  return statuses.map((s) => ({
    value: String(s.id),
    label: s.name,
  }));
}