"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { Decimal } from "@prisma/client/runtime/library";
import { markExpenseRecordsForAgentChange } from "@/lib/finance/auto-generate";

// 代理店契約履歴データの型定義
export type AgentContractHistoryData = {
  contractStartDate: string;
  contractEndDate: string | null;
  status: string;
  initialFee: number | null;
  monthlyFee: number | null;
  // 月額プラン
  defaultMpInitialRate: number | null;
  defaultMpInitialDuration: number | null;
  defaultMpMonthlyType: string | null;
  defaultMpMonthlyRate: number | null;
  defaultMpMonthlyFixed: number | null;
  defaultMpMonthlyDuration: number | null;
  // 成果報酬プラン
  defaultPpInitialRate: number | null;
  defaultPpInitialDuration: number | null;
  defaultPpPerfType: string | null;
  defaultPpPerfRate: number | null;
  defaultPpPerfFixed: number | null;
  defaultPpPerfDuration: number | null;
  note: string | null;
};

export type CommissionOverrideData = {
  agentContractHistoryId: number;
  stpCompanyId: number;
  // 月額プラン
  mpInitialRate: number | null;
  mpInitialDuration: number | null;
  mpMonthlyType: string | null;
  mpMonthlyRate: number | null;
  mpMonthlyFixed: number | null;
  mpMonthlyDuration: number | null;
  // 成果報酬プラン
  ppInitialRate: number | null;
  ppInitialDuration: number | null;
  ppPerfType: string | null;
  ppPerfRate: number | null;
  ppPerfFixed: number | null;
  ppPerfDuration: number | null;
  note: string | null;
};

function decimalToNumber(val: Decimal | null): number | null {
  return val !== null ? Number(val) : null;
}

// 代理店契約履歴一覧取得
export async function getAgentContractHistories(agentId: number) {
  const histories = await prisma.stpAgentContractHistory.findMany({
    where: {
      agentId,
      deletedAt: null,
    },
    include: {
      commissionOverrides: {
        include: {
          stpCompany: {
            include: { company: true },
          },
        },
      },
    },
    orderBy: { contractStartDate: "desc" },
  });

  return histories.map((h) => ({
    id: h.id,
    agentId: h.agentId,
    contractStartDate: h.contractStartDate.toISOString().split("T")[0],
    contractEndDate: h.contractEndDate?.toISOString().split("T")[0] || null,
    status: h.status,
    initialFee: h.initialFee,
    monthlyFee: h.monthlyFee,
    // 月額プラン
    defaultMpInitialRate: decimalToNumber(h.defaultMpInitialRate),
    defaultMpInitialDuration: h.defaultMpInitialDuration,
    defaultMpMonthlyType: h.defaultMpMonthlyType,
    defaultMpMonthlyRate: decimalToNumber(h.defaultMpMonthlyRate),
    defaultMpMonthlyFixed: h.defaultMpMonthlyFixed,
    defaultMpMonthlyDuration: h.defaultMpMonthlyDuration,
    // 成果報酬プラン
    defaultPpInitialRate: decimalToNumber(h.defaultPpInitialRate),
    defaultPpInitialDuration: h.defaultPpInitialDuration,
    defaultPpPerfType: h.defaultPpPerfType,
    defaultPpPerfRate: decimalToNumber(h.defaultPpPerfRate),
    defaultPpPerfFixed: h.defaultPpPerfFixed,
    defaultPpPerfDuration: h.defaultPpPerfDuration,
    note: h.note,
    commissionOverrides: h.commissionOverrides.map((o) => ({
      id: o.id,
      agentContractHistoryId: o.agentContractHistoryId,
      stpCompanyId: o.stpCompanyId,
      stpCompanyName: `${o.stpCompany.company.companyCode} ${o.stpCompany.company.name}`,
      // 月額プラン
      mpInitialRate: decimalToNumber(o.mpInitialRate),
      mpInitialDuration: o.mpInitialDuration,
      mpMonthlyType: o.mpMonthlyType,
      mpMonthlyRate: decimalToNumber(o.mpMonthlyRate),
      mpMonthlyFixed: o.mpMonthlyFixed,
      mpMonthlyDuration: o.mpMonthlyDuration,
      // 成果報酬プラン
      ppInitialRate: decimalToNumber(o.ppInitialRate),
      ppInitialDuration: o.ppInitialDuration,
      ppPerfType: o.ppPerfType,
      ppPerfRate: decimalToNumber(o.ppPerfRate),
      ppPerfFixed: o.ppPerfFixed,
      ppPerfDuration: o.ppPerfDuration,
      note: o.note,
    })),
  }));
}

// 代理店契約履歴追加
export async function addAgentContractHistory(
  agentId: number,
  data: AgentContractHistoryData
): Promise<{ success: boolean; error?: string }> {
  try {
    await prisma.stpAgentContractHistory.create({
      data: {
        agentId,
        contractStartDate: new Date(data.contractStartDate),
        contractEndDate: data.contractEndDate ? new Date(data.contractEndDate) : null,
        status: data.status,
        initialFee: data.initialFee,
        monthlyFee: data.monthlyFee,
        defaultMpInitialRate: data.defaultMpInitialRate,
        defaultMpInitialDuration: data.defaultMpInitialDuration,
        defaultMpMonthlyType: data.defaultMpMonthlyType,
        defaultMpMonthlyRate: data.defaultMpMonthlyRate,
        defaultMpMonthlyFixed: data.defaultMpMonthlyFixed,
        defaultMpMonthlyDuration: data.defaultMpMonthlyDuration,
        defaultPpInitialRate: data.defaultPpInitialRate,
        defaultPpInitialDuration: data.defaultPpInitialDuration,
        defaultPpPerfType: data.defaultPpPerfType,
        defaultPpPerfRate: data.defaultPpPerfRate,
        defaultPpPerfFixed: data.defaultPpPerfFixed,
        defaultPpPerfDuration: data.defaultPpPerfDuration,
        note: data.note,
      },
    });

    revalidatePath("/stp/agents");
    return { success: true };
  } catch (error) {
    console.error("代理店契約履歴追加エラー:", error);
    const errorMessage = error instanceof Error ? error.message : "不明なエラーが発生しました";
    return { success: false, error: errorMessage };
  }
}

// 代理店契約履歴更新
export async function updateAgentContractHistory(
  id: number,
  data: AgentContractHistoryData
): Promise<{ success: boolean; error?: string; affectedFinanceCount?: number }> {
  try {
    await prisma.stpAgentContractHistory.update({
      where: { id },
      data: {
        contractStartDate: new Date(data.contractStartDate),
        contractEndDate: data.contractEndDate ? new Date(data.contractEndDate) : null,
        status: data.status,
        initialFee: data.initialFee,
        monthlyFee: data.monthlyFee,
        defaultMpInitialRate: data.defaultMpInitialRate,
        defaultMpInitialDuration: data.defaultMpInitialDuration,
        defaultMpMonthlyType: data.defaultMpMonthlyType,
        defaultMpMonthlyRate: data.defaultMpMonthlyRate,
        defaultMpMonthlyFixed: data.defaultMpMonthlyFixed,
        defaultMpMonthlyDuration: data.defaultMpMonthlyDuration,
        defaultPpInitialRate: data.defaultPpInitialRate,
        defaultPpInitialDuration: data.defaultPpInitialDuration,
        defaultPpPerfType: data.defaultPpPerfType,
        defaultPpPerfRate: data.defaultPpPerfRate,
        defaultPpPerfFixed: data.defaultPpPerfFixed,
        defaultPpPerfDuration: data.defaultPpPerfDuration,
        note: data.note,
      },
    });

    // 既存の経費レコードに差異をマーク（スナップショット方式）
    const affectedFinanceCount = await markExpenseRecordsForAgentChange(id);

    revalidatePath("/stp/agents");
    revalidatePath("/stp/finance/expenses");
    revalidatePath("/stp/finance");
    return { success: true, affectedFinanceCount };
  } catch (error) {
    console.error("代理店契約履歴更新エラー:", error);
    const errorMessage = error instanceof Error ? error.message : "不明なエラーが発生しました";
    return { success: false, error: errorMessage };
  }
}

// 代理店契約履歴 論理削除
export async function deleteAgentContractHistory(
  id: number
): Promise<{ success: boolean; error?: string }> {
  try {
    await prisma.stpAgentContractHistory.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    revalidatePath("/stp/agents");
    return { success: true };
  } catch (error) {
    console.error("代理店契約履歴削除エラー:", error);
    const errorMessage = error instanceof Error ? error.message : "不明なエラーが発生しました";
    return { success: false, error: errorMessage };
  }
}

// 紹介企業一覧取得
export async function getReferredCompanies(agentId: number) {
  const agent = await prisma.stpAgent.findUnique({
    where: { id: agentId },
  });
  if (!agent) return [];

  const stpCompanies = await prisma.stpCompany.findMany({
    where: { agentId },
    include: {
      company: true,
    },
    orderBy: { id: "asc" },
  });

  return stpCompanies.map((sc) => ({
    id: sc.id,
    companyCode: sc.company.companyCode,
    companyName: sc.company.name,
  }));
}

// 企業別報酬例外追加
export async function addCommissionOverride(
  data: CommissionOverrideData
): Promise<{ success: boolean; error?: string }> {
  try {
    await prisma.stpAgentCommissionOverride.create({
      data: {
        agentContractHistoryId: data.agentContractHistoryId,
        stpCompanyId: data.stpCompanyId,
        mpInitialRate: data.mpInitialRate,
        mpInitialDuration: data.mpInitialDuration,
        mpMonthlyType: data.mpMonthlyType,
        mpMonthlyRate: data.mpMonthlyRate,
        mpMonthlyFixed: data.mpMonthlyFixed,
        mpMonthlyDuration: data.mpMonthlyDuration,
        ppInitialRate: data.ppInitialRate,
        ppInitialDuration: data.ppInitialDuration,
        ppPerfType: data.ppPerfType,
        ppPerfRate: data.ppPerfRate,
        ppPerfFixed: data.ppPerfFixed,
        ppPerfDuration: data.ppPerfDuration,
        note: data.note,
      },
    });

    revalidatePath("/stp/agents");
    return { success: true };
  } catch (error) {
    console.error("報酬例外追加エラー:", error);
    const errorMessage = error instanceof Error ? error.message : "不明なエラーが発生しました";
    return { success: false, error: errorMessage };
  }
}

// 企業別報酬例外更新
export async function updateCommissionOverride(
  id: number,
  data: Omit<CommissionOverrideData, "agentContractHistoryId" | "stpCompanyId">
): Promise<{ success: boolean; error?: string; affectedFinanceCount?: number }> {
  try {
    const override = await prisma.stpAgentCommissionOverride.update({
      where: { id },
      data: {
        mpInitialRate: data.mpInitialRate,
        mpInitialDuration: data.mpInitialDuration,
        mpMonthlyType: data.mpMonthlyType,
        mpMonthlyRate: data.mpMonthlyRate,
        mpMonthlyFixed: data.mpMonthlyFixed,
        mpMonthlyDuration: data.mpMonthlyDuration,
        ppInitialRate: data.ppInitialRate,
        ppInitialDuration: data.ppInitialDuration,
        ppPerfType: data.ppPerfType,
        ppPerfRate: data.ppPerfRate,
        ppPerfFixed: data.ppPerfFixed,
        ppPerfDuration: data.ppPerfDuration,
        note: data.note,
      },
    });

    // 既存の経費レコードに差異をマーク（スナップショット方式）
    const affectedFinanceCount = await markExpenseRecordsForAgentChange(override.agentContractHistoryId);

    revalidatePath("/stp/agents");
    revalidatePath("/stp/finance/expenses");
    revalidatePath("/stp/finance");
    return { success: true, affectedFinanceCount };
  } catch (error) {
    console.error("報酬例外更新エラー:", error);
    const errorMessage = error instanceof Error ? error.message : "不明なエラーが発生しました";
    return { success: false, error: errorMessage };
  }
}

// 企業別報酬例外削除（物理削除）
export async function deleteCommissionOverride(
  id: number
): Promise<{ success: boolean; error?: string }> {
  try {
    await prisma.stpAgentCommissionOverride.delete({
      where: { id },
    });

    revalidatePath("/stp/agents");
    return { success: true };
  } catch (error) {
    console.error("報酬例外削除エラー:", error);
    const errorMessage = error instanceof Error ? error.message : "不明なエラーが発生しました";
    return { success: false, error: errorMessage };
  }
}
