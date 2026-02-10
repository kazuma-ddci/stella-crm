"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireEdit } from "@/lib/auth";
import { calcTaxAmount, calcTotalWithTax } from "@/lib/finance/auto-generate";
import { createFinanceEditLog } from "@/lib/finance/edit-log";
import { ensureMonthNotClosed } from "@/lib/finance/monthly-close";
import { generateInvoiceNumber } from "@/lib/finance/invoice-number";

export async function addRevenueRecord(data: Record<string, unknown>) {
  await requireEdit("stp");
  const taxType = (data.taxType as string) || "tax_included";
  const taxRate = data.taxRate != null ? Number(data.taxRate) : 10;
  const expectedAmount = Number(data.expectedAmount);
  const taxAmount = calcTaxAmount(expectedAmount, taxType, taxRate);

  await prisma.stpRevenueRecord.create({
    data: {
      stpCompanyId: Number(data.stpCompanyId),
      contractHistoryId: data.contractHistoryId
        ? Number(data.contractHistoryId)
        : null,
      candidateId: data.candidateId ? Number(data.candidateId) : null,
      revenueType: data.revenueType as string,
      targetMonth: new Date(data.targetMonth as string),
      expectedAmount,
      taxType,
      taxRate,
      taxAmount,
      status: (data.status as string) || "pending",
      invoiceDate: data.invoiceDate
        ? new Date(data.invoiceDate as string)
        : null,
      dueDate: data.dueDate ? new Date(data.dueDate as string) : null,
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

  revalidatePath("/stp/finance/revenue");
  revalidatePath("/stp/finance");
}

export async function updateRevenueRecord(
  id: number,
  data: Record<string, unknown>
) {
  await requireEdit("stp");
  // 月次締めチェック
  const currentRecord = await prisma.stpRevenueRecord.findUnique({ where: { id } });
  if (currentRecord?.targetMonth) await ensureMonthNotClosed(currentRecord.targetMonth);

  const updateData: Record<string, unknown> = {};

  if ("stpCompanyId" in data)
    updateData.stpCompanyId = Number(data.stpCompanyId);
  if ("contractHistoryId" in data)
    updateData.contractHistoryId = data.contractHistoryId
      ? Number(data.contractHistoryId)
      : null;
  if ("candidateId" in data)
    updateData.candidateId = data.candidateId
      ? Number(data.candidateId)
      : null;
  if ("revenueType" in data)
    updateData.revenueType = data.revenueType as string;
  if ("targetMonth" in data)
    updateData.targetMonth = new Date(data.targetMonth as string);
  if ("expectedAmount" in data)
    updateData.expectedAmount = Number(data.expectedAmount);
  if ("status" in data) updateData.status = data.status as string;
  if ("invoiceDate" in data)
    updateData.invoiceDate = data.invoiceDate
      ? new Date(data.invoiceDate as string)
      : null;
  if ("dueDate" in data)
    updateData.dueDate = data.dueDate
      ? new Date(data.dueDate as string)
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

  // expectedAmount, taxType, taxRate のいずれかが変更されたら taxAmount を再計算
  const needsTaxRecalc = "expectedAmount" in data || "taxType" in data || "taxRate" in data;

  if (Object.keys(updateData).length > 0) {
    if (needsTaxRecalc) {
      // 現在のレコードを取得して未指定フィールドを補完
      const current = await prisma.stpRevenueRecord.findUnique({ where: { id } });
      if (current) {
        const amount = (updateData.expectedAmount as number) ?? current.expectedAmount;
        const type = (updateData.taxType as string) ?? current.taxType;
        const rate = (updateData.taxRate as number) ?? current.taxRate;
        updateData.taxAmount = calcTaxAmount(amount, type, rate);
      }
    }

    await prisma.stpRevenueRecord.update({
      where: { id },
      data: updateData,
    });
  }

  revalidatePath("/stp/finance/revenue");
  revalidatePath("/stp/finance");
}

// 個別請求書生成（1つの売上レコードに対して1つの請求書）
export async function createInvoiceFromRevenue(revenueRecordId: number) {
  await requireEdit("stp");
  const revenue = await prisma.stpRevenueRecord.findUnique({
    where: { id: revenueRecordId },
  });
  if (!revenue) return;

  // 既に請求書に紐づいていればスキップ
  if (revenue.invoiceId) return;

  const totalAmount = calcTotalWithTax(revenue.expectedAmount, revenue.taxType, revenue.taxRate);
  const taxAmount = calcTaxAmount(revenue.expectedAmount, revenue.taxType, revenue.taxRate);
  const invoiceNumber = await generateInvoiceNumber();

  const invoice = await prisma.stpInvoice.create({
    data: {
      direction: "outgoing",
      stpCompanyId: revenue.stpCompanyId,
      invoiceNumber,
      invoiceDate: revenue.invoiceDate,
      dueDate: revenue.dueDate,
      totalAmount,
      taxAmount,
      status: "draft",
    },
  });

  await prisma.stpRevenueRecord.update({
    where: { id: revenueRecordId },
    data: { invoiceId: invoice.id },
  });

  revalidatePath("/stp/finance/revenue");
  revalidatePath("/stp/finance/invoices");
  revalidatePath("/stp/finance");
  return invoice;
}

// 一括請求書生成（同一企業×同一月の全未請求レコードをまとめて1つの請求書）
export async function createBatchInvoice(stpCompanyId: number, targetMonth: string) {
  await requireEdit("stp");
  const monthDate = new Date(targetMonth + "-01");

  // 対象レコード: 同一企業×同一月で、まだ請求書未紐づけ・未取消
  const records = await prisma.stpRevenueRecord.findMany({
    where: {
      stpCompanyId,
      targetMonth: monthDate,
      invoiceId: null,
      deletedAt: null,
      status: { not: "cancelled" },
    },
  });

  if (records.length === 0) return null;

  // 合計金額を計算
  let totalAmount = 0;
  let totalTax = 0;
  for (const r of records) {
    totalAmount += calcTotalWithTax(r.expectedAmount, r.taxType, r.taxRate);
    totalTax += calcTaxAmount(r.expectedAmount, r.taxType, r.taxRate);
  }

  const invoiceNumber = await generateInvoiceNumber();

  const invoice = await prisma.stpInvoice.create({
    data: {
      direction: "outgoing",
      stpCompanyId,
      invoiceNumber,
      totalAmount,
      taxAmount: totalTax,
      status: "draft",
    },
  });

  // 全レコードにinvoiceIdをセット
  await prisma.stpRevenueRecord.updateMany({
    where: { id: { in: records.map((r) => r.id) } },
    data: { invoiceId: invoice.id },
  });

  revalidatePath("/stp/finance/revenue");
  revalidatePath("/stp/finance/invoices");
  revalidatePath("/stp/finance");
  return invoice;
}

export async function updateInvoiceFromRevenue(
  invoiceId: number,
  data: Record<string, unknown>
) {
  await requireEdit("stp");
  const updateData: Record<string, unknown> = {};

  if ("status" in data) updateData.status = data.status as string;
  if ("invoiceNumber" in data)
    updateData.invoiceNumber = (data.invoiceNumber as string) || null;
  if ("invoiceDate" in data)
    updateData.invoiceDate = data.invoiceDate
      ? new Date(data.invoiceDate as string)
      : null;
  if ("dueDate" in data)
    updateData.dueDate = data.dueDate
      ? new Date(data.dueDate as string)
      : null;
  if ("totalAmount" in data)
    updateData.totalAmount = data.totalAmount
      ? Number(data.totalAmount)
      : null;
  if ("taxAmount" in data)
    updateData.taxAmount = data.taxAmount ? Number(data.taxAmount) : null;
  if ("filePath" in data)
    updateData.filePath = (data.filePath as string) || null;
  if ("fileName" in data)
    updateData.fileName = (data.fileName as string) || null;

  if (Object.keys(updateData).length > 0) {
    await prisma.stpInvoice.update({
      where: { id: invoiceId },
      data: updateData,
    });
  }

  revalidatePath("/stp/finance/revenue");
  revalidatePath("/stp/finance/invoices");
  revalidatePath("/stp/finance");
}

export async function deleteRevenueRecord(id: number) {
  await requireEdit("stp");
  // 月次締めチェック
  const record = await prisma.stpRevenueRecord.findUnique({ where: { id } });
  if (record?.targetMonth) await ensureMonthNotClosed(record.targetMonth);

  await prisma.stpRevenueRecord.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
  revalidatePath("/stp/finance/revenue");
  revalidatePath("/stp/finance");
}

// 最新値を反映（expectedAmountをlatestCalculatedAmountで上書き）
export async function applyLatestRevenueAmount(id: number) {
  await requireEdit("stp");
  const record = await prisma.stpRevenueRecord.findUnique({ where: { id } });
  if (!record || record.latestCalculatedAmount == null) return;

  const taxAmount = calcTaxAmount(
    record.latestCalculatedAmount,
    record.taxType,
    record.taxRate
  );

  await prisma.stpRevenueRecord.update({
    where: { id },
    data: {
      expectedAmount: record.latestCalculatedAmount,
      taxAmount,
      latestCalculatedAmount: null,
      sourceDataChangedAt: null,
    },
  });

  revalidatePath("/stp/finance/revenue");
  revalidatePath("/stp/finance");
}

// 現在値を維持（差異通知をクリア）
export async function dismissRevenueSourceChange(id: number) {
  await requireEdit("stp");
  await prisma.stpRevenueRecord.update({
    where: { id },
    data: {
      latestCalculatedAmount: null,
      sourceDataChangedAt: null,
    },
  });

  revalidatePath("/stp/finance/revenue");
  revalidatePath("/stp/finance");
}

export async function logRevenueEdit(params: {
  revenueRecordId: number;
  editType: "field_change" | "amount_mismatch";
  fieldName?: string;
  oldValue?: string;
  newValue?: string;
  reason?: string;
}) {
  await requireEdit("stp");
  await createFinanceEditLog({
    revenueRecordId: params.revenueRecordId,
    editType: params.editType,
    fieldName: params.fieldName,
    oldValue: params.oldValue,
    newValue: params.newValue,
    reason: params.reason,
  });
}
