"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

// 契約履歴データの型定義
export type ContractHistoryData = {
  industryType: string;
  contractPlan: string;
  contractStartDate: string;
  contractEndDate: string | null;
  initialFee: number;
  monthlyFee: number;
  performanceFee: number;
  salesStaffId: number | null;
  operationStaffId: number | null;
  status: string;
  note: string | null;
};

// 契約履歴一覧取得（deletedAt: null のみ）
export async function getContractHistories(companyId: number) {
  const histories = await prisma.stpContractHistory.findMany({
    where: {
      companyId,
      deletedAt: null,
    },
    include: {
      salesStaff: true,
      operationStaff: true,
    },
    orderBy: { contractStartDate: "desc" },
  });

  return histories.map((h) => ({
    id: h.id,
    companyId: h.companyId,
    industryType: h.industryType,
    contractPlan: h.contractPlan,
    contractStartDate: h.contractStartDate.toISOString().split("T")[0],
    contractEndDate: h.contractEndDate?.toISOString().split("T")[0] || null,
    initialFee: h.initialFee,
    monthlyFee: h.monthlyFee,
    performanceFee: h.performanceFee,
    salesStaffId: h.salesStaffId,
    salesStaffName: h.salesStaff?.name || null,
    operationStaffId: h.operationStaffId,
    operationStaffName: h.operationStaff?.name || null,
    status: h.status,
    note: h.note,
    createdAt: h.createdAt.toISOString(),
    updatedAt: h.updatedAt.toISOString(),
  }));
}

// 契約履歴追加
export async function addContractHistory(companyId: number, data: ContractHistoryData) {
  await prisma.stpContractHistory.create({
    data: {
      companyId,
      industryType: data.industryType,
      contractPlan: data.contractPlan,
      contractStartDate: new Date(data.contractStartDate),
      contractEndDate: data.contractEndDate ? new Date(data.contractEndDate) : null,
      initialFee: data.initialFee,
      monthlyFee: data.monthlyFee,
      performanceFee: data.performanceFee,
      salesStaffId: data.salesStaffId,
      operationStaffId: data.operationStaffId,
      status: data.status,
      note: data.note,
    },
  });

  revalidatePath("/stp/companies");
  revalidatePath("/companies");
}

// 契約履歴更新
export async function updateContractHistory(id: number, data: ContractHistoryData) {
  await prisma.stpContractHistory.update({
    where: { id },
    data: {
      industryType: data.industryType,
      contractPlan: data.contractPlan,
      contractStartDate: new Date(data.contractStartDate),
      contractEndDate: data.contractEndDate ? new Date(data.contractEndDate) : null,
      initialFee: data.initialFee,
      monthlyFee: data.monthlyFee,
      performanceFee: data.performanceFee,
      salesStaffId: data.salesStaffId,
      operationStaffId: data.operationStaffId,
      status: data.status,
      note: data.note,
    },
  });

  revalidatePath("/stp/companies");
  revalidatePath("/companies");
}

// 論理削除（deletedAt = new Date()）
export async function deleteContractHistory(id: number) {
  await prisma.stpContractHistory.update({
    where: { id },
    data: { deletedAt: new Date() },
  });

  revalidatePath("/stp/companies");
  revalidatePath("/companies");
}

// スタッフ一覧取得（担当営業・担当運用の選択用）
export async function getStaffList() {
  const staffList = await prisma.masterStaff.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
    },
  });

  return staffList.map((s) => ({
    value: String(s.id),
    label: s.name,
  }));
}
