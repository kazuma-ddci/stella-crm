"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { requireEdit } from "@/lib/auth";
import {
  recalcTransactionStatus,
  recalcRecordPaymentStatus,
} from "@/lib/finance/payment-matching";

export async function addPaymentTransaction(data: Record<string, unknown>) {
  await requireEdit("stp");
  await prisma.stpPaymentTransaction.create({
    data: {
      direction: data.direction as string,
      transactionDate: new Date(data.transactionDate as string),
      amount: Number(data.amount),
      counterpartyName: (data.counterpartyName as string) || null,
      bankAccountName: (data.bankAccountName as string) || null,
      accountCode: (data.accountCode as string) || null,
      accountName: (data.accountName as string) || null,
      subAccountCode: (data.subAccountCode as string) || null,
      subAccountName: (data.subAccountName as string) || null,
      withholdingTaxAmount: data.withholdingTaxAmount
        ? Number(data.withholdingTaxAmount)
        : null,
      note: (data.note as string) || null,
    },
  });
  revalidatePath("/stp/finance/payments");
  revalidatePath("/stp/finance");
}

export async function updatePaymentTransaction(
  id: number,
  data: Record<string, unknown>
) {
  await requireEdit("stp");
  const updateData: Record<string, unknown> = {};
  if ("direction" in data) updateData.direction = data.direction as string;
  if ("transactionDate" in data)
    updateData.transactionDate = new Date(data.transactionDate as string);
  if ("amount" in data) updateData.amount = Number(data.amount);
  if ("counterpartyName" in data)
    updateData.counterpartyName =
      (data.counterpartyName as string) || null;
  if ("bankAccountName" in data)
    updateData.bankAccountName =
      (data.bankAccountName as string) || null;
  if ("accountCode" in data)
    updateData.accountCode = (data.accountCode as string) || null;
  if ("accountName" in data)
    updateData.accountName = (data.accountName as string) || null;
  if ("subAccountCode" in data)
    updateData.subAccountCode = (data.subAccountCode as string) || null;
  if ("subAccountName" in data)
    updateData.subAccountName = (data.subAccountName as string) || null;
  if ("withholdingTaxAmount" in data)
    updateData.withholdingTaxAmount = data.withholdingTaxAmount
      ? Number(data.withholdingTaxAmount)
      : null;
  if ("status" in data) updateData.status = data.status as string;
  if ("note" in data) updateData.note = (data.note as string) || null;

  if (Object.keys(updateData).length > 0) {
    await prisma.stpPaymentTransaction.update({
      where: { id },
      data: updateData,
    });
  }
  revalidatePath("/stp/finance/payments");
  revalidatePath("/stp/finance");
}

export async function deletePaymentTransaction(id: number) {
  await requireEdit("stp");
  await prisma.stpPaymentTransaction.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
  revalidatePath("/stp/finance/payments");
  revalidatePath("/stp/finance");
}

// 消込操作: $transactionで排他制御
export async function allocatePayment(
  paymentTransactionId: number,
  allocations: Array<{
    revenueRecordId?: number;
    expenseRecordId?: number;
    allocatedAmount: number;
    note?: string;
  }>
) {
  await requireEdit("stp");
  await prisma.$transaction(async (tx) => {
    for (const alloc of allocations) {
      await tx.stpPaymentAllocation.create({
        data: {
          paymentTransactionId,
          revenueRecordId: alloc.revenueRecordId || null,
          expenseRecordId: alloc.expenseRecordId || null,
          allocatedAmount: alloc.allocatedAmount,
          note: alloc.note || null,
        },
      });
    }
  });

  // ステータス再計算
  await recalcTransactionStatus(paymentTransactionId);
  for (const alloc of allocations) {
    if (alloc.revenueRecordId)
      await recalcRecordPaymentStatus("revenue", alloc.revenueRecordId);
    if (alloc.expenseRecordId)
      await recalcRecordPaymentStatus("expense", alloc.expenseRecordId);
  }

  revalidatePath("/stp/finance/payments");
  revalidatePath("/stp/finance/revenue");
  revalidatePath("/stp/finance/expenses");
  revalidatePath("/stp/finance");
}

export async function removeAllocation(allocationId: number) {
  await requireEdit("stp");
  const alloc = await prisma.stpPaymentAllocation.findUnique({
    where: { id: allocationId },
  });
  if (!alloc) return;

  await prisma.stpPaymentAllocation.delete({ where: { id: allocationId } });

  await recalcTransactionStatus(alloc.paymentTransactionId);
  if (alloc.revenueRecordId)
    await recalcRecordPaymentStatus("revenue", alloc.revenueRecordId);
  if (alloc.expenseRecordId)
    await recalcRecordPaymentStatus("expense", alloc.expenseRecordId);

  revalidatePath("/stp/finance/payments");
  revalidatePath("/stp/finance/revenue");
  revalidatePath("/stp/finance/expenses");
  revalidatePath("/stp/finance");
}
