"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { autoGenerateFinanceForContractHistory, markFinanceRecordsForContractChange } from "@/lib/finance/auto-generate";

// 契約履歴データの型定義
export type ContractHistoryData = {
  industryType: string;
  contractPlan: string;
  jobMedia: string | null;
  contractStartDate: string;
  contractEndDate: string | null;
  initialFee: number;
  monthlyFee: number;
  performanceFee: number;
  salesStaffId: number | null;
  operationStaffId: number | null;
  status: string;
  note: string | null;
  operationStatus: string | null;
  accountId: string | null;
  accountPass: string | null;
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
    jobMedia: h.jobMedia,
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
    operationStatus: h.operationStatus,
    accountId: h.accountId,
    accountPass: h.accountPass,
    createdAt: h.createdAt.toISOString(),
    updatedAt: h.updatedAt.toISOString(),
  }));
}

// 契約履歴追加
export async function addContractHistory(companyId: number, data: ContractHistoryData): Promise<{ success: boolean; error?: string }> {
  try {
    const created = await prisma.stpContractHistory.create({
      data: {
        companyId,
        industryType: data.industryType,
        contractPlan: data.contractPlan,
        jobMedia: data.jobMedia,
        contractStartDate: new Date(data.contractStartDate),
        contractEndDate: data.contractEndDate ? new Date(data.contractEndDate) : null,
        initialFee: data.initialFee,
        monthlyFee: data.monthlyFee,
        performanceFee: data.performanceFee,
        salesStaffId: data.salesStaffId,
        operationStaffId: data.operationStaffId,
        status: data.status,
        note: data.note,
        operationStatus: data.operationStatus,
        accountId: data.accountId,
        accountPass: data.accountPass,
      },
    });

    revalidatePath("/stp/companies");
    revalidatePath("/companies");
    return { success: true };
  } catch (error) {
    console.error("契約履歴追加エラー:", error);
    const errorMessage = error instanceof Error ? error.message : "不明なエラーが発生しました";
    return { success: false, error: errorMessage };
  }
}

// 契約履歴更新
export async function updateContractHistory(id: number, data: ContractHistoryData): Promise<{ success: boolean; error?: string; affectedFinanceCount?: number }> {
  try {
    await prisma.stpContractHistory.update({
      where: { id },
      data: {
        industryType: data.industryType,
        contractPlan: data.contractPlan,
        jobMedia: data.jobMedia,
        contractStartDate: new Date(data.contractStartDate),
        contractEndDate: data.contractEndDate ? new Date(data.contractEndDate) : null,
        initialFee: data.initialFee,
        monthlyFee: data.monthlyFee,
        performanceFee: data.performanceFee,
        salesStaffId: data.salesStaffId,
        operationStaffId: data.operationStaffId,
        status: data.status,
        note: data.note,
        operationStatus: data.operationStatus,
        accountId: data.accountId,
        accountPass: data.accountPass,
      },
    });

    // 既存の会計レコードに差異をマーク（スナップショット方式）
    const affectedFinanceCount = await markFinanceRecordsForContractChange(id);

    revalidatePath("/stp/companies");
    revalidatePath("/companies");
    revalidatePath("/stp/finance");
    revalidatePath("/stp/finance/revenue");
    revalidatePath("/stp/finance/expenses");
    return { success: true, affectedFinanceCount };
  } catch (error) {
    console.error("契約履歴更新エラー:", error);
    const errorMessage = error instanceof Error ? error.message : "不明なエラーが発生しました";
    return { success: false, error: errorMessage };
  }
}

// 論理削除（deletedAt = new Date()）
export async function deleteContractHistory(id: number): Promise<{ success: boolean; error?: string }> {
  try {
    await prisma.stpContractHistory.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    revalidatePath("/stp/companies");
    revalidatePath("/companies");
    return { success: true };
  } catch (error) {
    console.error("契約履歴削除エラー:", error);
    const errorMessage = error instanceof Error ? error.message : "不明なエラーが発生しました";
    return { success: false, error: errorMessage };
  }
}

// スタッフ一覧取得（担当営業・担当運用の選択用）
export async function getStaffList() {
  const staffList = await prisma.masterStaff.findMany({
    where: { isActive: true, isSystemUser: false },
    orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
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
