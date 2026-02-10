"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireEdit } from "@/lib/auth";
import { calcTaxAmount } from "@/lib/finance/auto-generate";
import { createFinanceEditLog } from "@/lib/finance/edit-log";
import { ensureMonthNotClosed } from "@/lib/finance/monthly-close";
import { calcWithholdingTax } from "@/lib/finance/withholding-tax";

export async function addExpenseRecord(data: Record<string, unknown>) {
  await requireEdit("stp");
  const taxType = (data.taxType as string) || "tax_included";
  const taxRate = data.taxRate != null ? Number(data.taxRate) : 10;
  const expectedAmount = Number(data.expectedAmount);
  const taxAmount = calcTaxAmount(expectedAmount, taxType, taxRate);

  // 代理店が個人事業主の場合に源泉徴収自動計算
  let withholdingTaxAmount: number | null = data.withholdingTaxAmount
    ? Number(data.withholdingTaxAmount)
    : null;
  let withholdingTaxRate: number | null = data.withholdingTaxRate
    ? Number(data.withholdingTaxRate)
    : null;
  let netPaymentAmount: number | null = data.netPaymentAmount
    ? Number(data.netPaymentAmount)
    : null;

  if (withholdingTaxAmount == null && data.agentId) {
    const agent = await prisma.stpAgent.findUnique({
      where: { id: Number(data.agentId) },
    });
    if (agent?.isIndividualBusiness) {
      withholdingTaxAmount = calcWithholdingTax(expectedAmount);
      withholdingTaxRate = expectedAmount <= 1_000_000 ? 10.21 : 20.42;
      netPaymentAmount = expectedAmount - withholdingTaxAmount;
    }
  }

  await prisma.stpExpenseRecord.create({
    data: {
      agentId: Number(data.agentId),
      stpCompanyId: data.stpCompanyId ? Number(data.stpCompanyId) : null,
      agentContractHistoryId: data.agentContractHistoryId
        ? Number(data.agentContractHistoryId)
        : null,
      contractHistoryId: data.contractHistoryId
        ? Number(data.contractHistoryId)
        : null,
      revenueRecordId: data.revenueRecordId
        ? Number(data.revenueRecordId)
        : null,
      expenseType: data.expenseType as string,
      targetMonth: new Date(data.targetMonth as string),
      expectedAmount,
      taxType,
      taxRate,
      taxAmount,
      withholdingTaxRate,
      withholdingTaxAmount,
      netPaymentAmount,
      status: (data.status as string) || "pending",
      approvedDate: data.approvedDate
        ? new Date(data.approvedDate as string)
        : null,
      paidDate: data.paidDate ? new Date(data.paidDate as string) : null,
      paidAmount: data.paidAmount ? Number(data.paidAmount) : null,
      accountingStatus: (data.accountingStatus as string) || "unprocessed",
      accountingService: (data.accountingService as string) || null,
      accountingExternalId: (data.accountingExternalId as string) || null,
      accountingSyncedAt: data.accountingSyncedAt
        ? new Date(data.accountingSyncedAt as string)
        : null,
      note: (data.note as string) || null,
    },
  });

  revalidatePath("/stp/finance/expenses");
  revalidatePath("/stp/finance");
}

export async function updateExpenseRecord(
  id: number,
  data: Record<string, unknown>
) {
  await requireEdit("stp");
  // 月次締めチェック
  const currentRecord = await prisma.stpExpenseRecord.findUnique({ where: { id } });
  if (currentRecord?.targetMonth) await ensureMonthNotClosed(currentRecord.targetMonth);

  const updateData: Record<string, unknown> = {};

  if ("agentId" in data) updateData.agentId = Number(data.agentId);
  if ("stpCompanyId" in data)
    updateData.stpCompanyId = data.stpCompanyId
      ? Number(data.stpCompanyId)
      : null;
  if ("agentContractHistoryId" in data)
    updateData.agentContractHistoryId = data.agentContractHistoryId
      ? Number(data.agentContractHistoryId)
      : null;
  if ("contractHistoryId" in data)
    updateData.contractHistoryId = data.contractHistoryId
      ? Number(data.contractHistoryId)
      : null;
  if ("revenueRecordId" in data)
    updateData.revenueRecordId = data.revenueRecordId
      ? Number(data.revenueRecordId)
      : null;
  if ("expenseType" in data)
    updateData.expenseType = data.expenseType as string;
  if ("targetMonth" in data)
    updateData.targetMonth = new Date(data.targetMonth as string);
  if ("expectedAmount" in data)
    updateData.expectedAmount = Number(data.expectedAmount);
  if ("status" in data) updateData.status = data.status as string;
  if ("approvedDate" in data)
    updateData.approvedDate = data.approvedDate
      ? new Date(data.approvedDate as string)
      : null;
  if ("paidDate" in data)
    updateData.paidDate = data.paidDate
      ? new Date(data.paidDate as string)
      : null;
  if ("paidAmount" in data)
    updateData.paidAmount = data.paidAmount
      ? Number(data.paidAmount)
      : null;
  if ("accountingStatus" in data)
    updateData.accountingStatus = data.accountingStatus as string;
  if ("accountingService" in data)
    updateData.accountingService = (data.accountingService as string) || null;
  if ("accountingExternalId" in data)
    updateData.accountingExternalId = (data.accountingExternalId as string) || null;
  if ("accountingSyncedAt" in data)
    updateData.accountingSyncedAt = data.accountingSyncedAt
      ? new Date(data.accountingSyncedAt as string)
      : null;
  if ("note" in data) updateData.note = (data.note as string) || null;
  if ("taxType" in data) updateData.taxType = (data.taxType as string) || "tax_included";
  if ("taxRate" in data) updateData.taxRate = data.taxRate != null ? Number(data.taxRate) : 10;
  if ("paymentStatus" in data)
    updateData.paymentStatus = (data.paymentStatus as string) || null;

  const needsTaxRecalc = "expectedAmount" in data || "taxType" in data || "taxRate" in data;

  if (Object.keys(updateData).length > 0) {
    if (needsTaxRecalc) {
      const current = await prisma.stpExpenseRecord.findUnique({ where: { id } });
      if (current) {
        const amount = (updateData.expectedAmount as number) ?? current.expectedAmount;
        const type = (updateData.taxType as string) ?? current.taxType;
        const rate = (updateData.taxRate as number) ?? current.taxRate;
        updateData.taxAmount = calcTaxAmount(amount, type, rate);
      }
    }

    await prisma.stpExpenseRecord.update({
      where: { id },
      data: updateData,
    });
  }

  revalidatePath("/stp/finance/expenses");
  revalidatePath("/stp/finance");
}

export async function deleteExpenseRecord(id: number) {
  await requireEdit("stp");
  // 月次締めチェック
  const record = await prisma.stpExpenseRecord.findUnique({ where: { id } });
  if (record?.targetMonth) await ensureMonthNotClosed(record.targetMonth);

  await prisma.stpExpenseRecord.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
  revalidatePath("/stp/finance/expenses");
  revalidatePath("/stp/finance");
}

// 最新値を反映（expectedAmountをlatestCalculatedAmountで上書き）
export async function applyLatestExpenseAmount(id: number) {
  await requireEdit("stp");
  const record = await prisma.stpExpenseRecord.findUnique({ where: { id } });
  if (!record || record.latestCalculatedAmount == null) return;

  const taxAmount = calcTaxAmount(
    record.latestCalculatedAmount,
    record.taxType,
    record.taxRate
  );

  await prisma.stpExpenseRecord.update({
    where: { id },
    data: {
      expectedAmount: record.latestCalculatedAmount,
      taxAmount,
      latestCalculatedAmount: null,
      sourceDataChangedAt: null,
    },
  });

  revalidatePath("/stp/finance/expenses");
  revalidatePath("/stp/finance");
}

// 現在値を維持（差異通知をクリア）
export async function dismissExpenseSourceChange(id: number) {
  await requireEdit("stp");
  await prisma.stpExpenseRecord.update({
    where: { id },
    data: {
      latestCalculatedAmount: null,
      sourceDataChangedAt: null,
    },
  });

  revalidatePath("/stp/finance/expenses");
  revalidatePath("/stp/finance");
}

export async function logExpenseEdit(params: {
  expenseRecordId: number;
  editType: "field_change" | "amount_mismatch";
  fieldName?: string;
  oldValue?: string;
  newValue?: string;
  reason?: string;
}) {
  await requireEdit("stp");
  await createFinanceEditLog({
    expenseRecordId: params.expenseRecordId,
    editType: params.editType,
    fieldName: params.fieldName,
    oldValue: params.oldValue,
    newValue: params.newValue,
    reason: params.reason,
  });
}
