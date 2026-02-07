"use server";

import { prisma } from "@/lib/prisma";
import { calcTotalWithTax } from "./auto-generate";

// 入出金の消込ステータスを再計算
export async function recalcTransactionStatus(
  paymentTransactionId: number
): Promise<void> {
  const transaction = await prisma.stpPaymentTransaction.findUnique({
    where: { id: paymentTransactionId },
    include: { allocations: true },
  });
  if (!transaction || transaction.deletedAt) return;

  const totalAllocated = transaction.allocations.reduce(
    (sum, a) => sum + a.allocatedAmount,
    0
  );

  let status: string;
  if (totalAllocated === 0) {
    status = "unmatched";
  } else if (totalAllocated < transaction.amount) {
    status = "partial";
  } else {
    status = "matched";
  }

  await prisma.stpPaymentTransaction.update({
    where: { id: paymentTransactionId },
    data: { status },
  });
}

// 売上/経費レコードの入金ステータスを配分から再計算
export async function recalcRecordPaymentStatus(
  type: "revenue" | "expense",
  recordId: number
): Promise<void> {
  if (type === "revenue") {
    const record = await prisma.stpRevenueRecord.findUnique({
      where: { id: recordId },
      include: { paymentAllocations: true },
    });
    if (!record || record.deletedAt) return;

    const totalAllocated = record.paymentAllocations.reduce(
      (sum, a) => sum + a.allocatedAmount,
      0
    );
    const expectedTotal = calcTotalWithTax(
      record.expectedAmount,
      record.taxType,
      record.taxRate
    );

    const updateData: Record<string, unknown> = {};
    updateData.paidAmount = totalAllocated;

    if (totalAllocated === 0) {
      updateData.paymentStatus = null;
    } else if (totalAllocated < expectedTotal) {
      updateData.paymentStatus = "partial";
    } else if (totalAllocated === expectedTotal) {
      updateData.paymentStatus = null;
      updateData.status = "paid";
      if (!record.paidDate) updateData.paidDate = new Date();
    } else {
      updateData.paymentStatus = "completed_different";
      updateData.status = "paid";
      if (!record.paidDate) updateData.paidDate = new Date();
    }

    await prisma.stpRevenueRecord.update({
      where: { id: recordId },
      data: updateData,
    });
  } else {
    const record = await prisma.stpExpenseRecord.findUnique({
      where: { id: recordId },
      include: { paymentAllocations: true },
    });
    if (!record || record.deletedAt) return;

    const totalAllocated = record.paymentAllocations.reduce(
      (sum, a) => sum + a.allocatedAmount,
      0
    );
    const expectedTotal = calcTotalWithTax(
      record.expectedAmount,
      record.taxType,
      record.taxRate
    );

    const updateData: Record<string, unknown> = {};
    updateData.paidAmount = totalAllocated;

    if (totalAllocated === 0) {
      updateData.paymentStatus = null;
    } else if (totalAllocated < expectedTotal) {
      updateData.paymentStatus = "partial";
    } else if (totalAllocated === expectedTotal) {
      updateData.paymentStatus = null;
      updateData.status = "paid";
      if (!record.paidDate) updateData.paidDate = new Date();
    } else {
      updateData.paymentStatus = "completed_different";
      updateData.status = "paid";
      if (!record.paidDate) updateData.paidDate = new Date();
    }

    await prisma.stpExpenseRecord.update({
      where: { id: recordId },
      data: updateData,
    });
  }
}
