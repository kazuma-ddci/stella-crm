"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

const STP_PROJECT_ID = 1; // 採用ブースト

type ContractInput = {
  contractType: string;
  title: string;
  startDate?: string | null;
  endDate?: string | null;
  currentStatusId?: number | null;
  targetDate?: string | null;
  signedDate?: string | null;
  signingMethod?: string | null;
  filePath?: string | null;
  fileName?: string | null;
  assignedTo?: string | null;
  note?: string | null;
};

/**
 * 契約番号を自動生成
 * フォーマット: STP-YYYYMM-XXX（XXXは月ごとの連番）
 */
async function generateContractNumber(): Promise<string> {
  const now = new Date();
  const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`;
  const prefix = `STP-${yearMonth}-`;

  // 今月の契約書の数を取得
  const count = await prisma.masterContract.count({
    where: {
      projectId: STP_PROJECT_ID,
      contractNumber: {
        startsWith: prefix,
      },
    },
  });

  const sequenceNumber = String(count + 1).padStart(3, "0");
  return `${prefix}${sequenceNumber}`;
}

/**
 * 次の契約番号をプレビュー取得（保存前に表示用）
 */
export async function getNextContractNumber(): Promise<string> {
  return generateContractNumber();
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
    },
    orderBy: { createdAt: "desc" },
  });

  return contracts.map((c) => ({
    id: c.id,
    contractType: c.contractType,
    title: c.title,
    contractNumber: c.contractNumber,
    startDate: c.startDate?.toISOString() || null,
    endDate: c.endDate?.toISOString() || null,
    currentStatusId: c.currentStatusId,
    currentStatusName: c.currentStatus?.name || null,
    targetDate: c.targetDate?.toISOString() || null,
    signedDate: c.signedDate?.toISOString() || null,
    signingMethod: c.signingMethod,
    filePath: c.filePath,
    fileName: c.fileName,
    assignedTo: c.assignedTo,
    note: c.note,
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
export async function addMasterContract(companyId: number, data: ContractInput): Promise<string> {
  // 契約番号を自動生成
  const contractNumber = await generateContractNumber();

  await prisma.masterContract.create({
    data: {
      companyId,
      projectId: STP_PROJECT_ID,
      contractNumber,
      contractType: data.contractType,
      title: data.title,
      startDate: data.startDate ? new Date(data.startDate) : null,
      endDate: data.endDate ? new Date(data.endDate) : null,
      currentStatusId: data.currentStatusId || null,
      targetDate: data.targetDate ? new Date(data.targetDate) : null,
      signedDate: data.signedDate ? new Date(data.signedDate) : null,
      signingMethod: data.signingMethod || null,
      filePath: data.filePath || null,
      fileName: data.fileName || null,
      assignedTo: data.assignedTo || null,
      note: data.note || null,
    },
  });

  revalidatePath("/stp/companies");
  revalidatePath("/stp/agents");

  return contractNumber;
}

/**
 * 契約書を更新
 * @param id 契約書ID
 * @param data 契約書データ
 */
export async function updateMasterContract(id: number, data: ContractInput) {
  await prisma.masterContract.update({
    where: { id },
    data: {
      contractType: data.contractType,
      title: data.title,
      startDate: data.startDate ? new Date(data.startDate) : null,
      endDate: data.endDate ? new Date(data.endDate) : null,
      currentStatusId: data.currentStatusId || null,
      targetDate: data.targetDate ? new Date(data.targetDate) : null,
      signedDate: data.signedDate ? new Date(data.signedDate) : null,
      signingMethod: data.signingMethod || null,
      filePath: data.filePath || null,
      fileName: data.fileName || null,
      assignedTo: data.assignedTo || null,
      note: data.note || null,
    },
  });

  revalidatePath("/stp/companies");
  revalidatePath("/stp/agents");
}

/**
 * 契約書を削除
 * @param id 契約書ID
 */
export async function deleteMasterContract(id: number) {
  await prisma.masterContract.delete({
    where: { id },
  });

  revalidatePath("/stp/companies");
  revalidatePath("/stp/agents");
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

/**
 * プロジェクトに割り当てられたスタッフ一覧を取得
 * @param projectId プロジェクトID（省略時はSTP_PROJECT_ID）
 */
export async function getStaffByProject(projectId?: number) {
  const targetProjectId = projectId ?? STP_PROJECT_ID;

  const staffAssignments = await prisma.staffProjectAssignment.findMany({
    where: {
      projectId: targetProjectId,
    },
    include: {
      staff: true,
    },
    orderBy: {
      staff: {
        name: "asc",
      },
    },
  });

  return staffAssignments
    .filter((a) => a.staff.isActive)
    .map((a) => ({
      value: String(a.staff.id),
      label: a.staff.name,
    }));
}
