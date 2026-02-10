"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { requireEdit } from "@/lib/auth";
import { generateInvoiceNumber } from "@/lib/finance/invoice-number";
import {
  calcInvoiceTaxSummary,
  calcInvoiceTotalFromSummary,
} from "@/lib/finance/invoice-tax";

export async function addInvoice(data: Record<string, unknown>) {
  await requireEdit("stp");
  // outgoing（発行）の場合のみ請求書番号を自動採番
  let invoiceNumber = (data.invoiceNumber as string) || null;
  const direction = (data.direction as string) || "outgoing";
  if (direction === "outgoing" && !invoiceNumber) {
    invoiceNumber = await generateInvoiceNumber();
  }

  await prisma.stpInvoice.create({
    data: {
      direction,
      stpCompanyId: data.stpCompanyId ? Number(data.stpCompanyId) : null,
      agentId: data.agentId ? Number(data.agentId) : null,
      invoiceNumber,
      invoiceDate: data.invoiceDate
        ? new Date(data.invoiceDate as string)
        : null,
      dueDate: data.dueDate ? new Date(data.dueDate as string) : null,
      totalAmount: data.totalAmount ? Number(data.totalAmount) : null,
      taxAmount: data.taxAmount ? Number(data.taxAmount) : null,
      status: (data.status as string) || "draft",
      filePath: (data.filePath as string) || null,
      fileName: (data.fileName as string) || null,
      note: (data.note as string) || null,
    },
  });
  revalidatePath("/stp/finance/invoices");
}

export async function updateInvoice(
  id: number,
  data: Record<string, unknown>
) {
  await requireEdit("stp");
  const updateData: Record<string, unknown> = {};

  if ("direction" in data) updateData.direction = data.direction as string;
  if ("stpCompanyId" in data)
    updateData.stpCompanyId = data.stpCompanyId
      ? Number(data.stpCompanyId)
      : null;
  if ("agentId" in data)
    updateData.agentId = data.agentId ? Number(data.agentId) : null;
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
  if ("status" in data) updateData.status = data.status as string;
  if ("filePath" in data)
    updateData.filePath = (data.filePath as string) || null;
  if ("fileName" in data)
    updateData.fileName = (data.fileName as string) || null;
  if ("note" in data) updateData.note = (data.note as string) || null;

  await prisma.stpInvoice.update({
    where: { id },
    data: updateData,
  });
  revalidatePath("/stp/finance/invoices");
}

export async function deleteInvoice(id: number) {
  await requireEdit("stp");
  // 紐づくレコードのinvoiceIdもクリア
  await prisma.stpRevenueRecord.updateMany({
    where: { invoiceId: id },
    data: { invoiceId: null },
  });
  await prisma.stpExpenseRecord.updateMany({
    where: { invoiceId: id },
    data: { invoiceId: null },
  });

  await prisma.stpInvoice.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
  revalidatePath("/stp/finance/invoices");
  revalidatePath("/stp/finance/revenue");
  revalidatePath("/stp/finance/expenses");
}

// 赤伝（クレジットノート）生成
export async function createCreditNote(originalInvoiceId: number) {
  await requireEdit("stp");
  const original = await prisma.stpInvoice.findUnique({
    where: { id: originalInvoiceId },
    include: { lineItems: true },
  });
  if (!original) return null;

  const creditNoteNumber = await generateInvoiceNumber();

  const creditNote = await prisma.stpInvoice.create({
    data: {
      direction: original.direction,
      stpCompanyId: original.stpCompanyId,
      agentId: original.agentId,
      invoiceNumber: creditNoteNumber,
      invoiceDate: new Date(),
      dueDate: original.dueDate,
      totalAmount: original.totalAmount ? -original.totalAmount : null,
      taxAmount: original.taxAmount ? -original.taxAmount : null,
      status: "draft",
      note: `赤伝: 元請求書 ${original.invoiceNumber || `#${original.id}`}`,
    },
  });

  // 明細行もマイナスでコピー
  if (original.lineItems.length > 0) {
    for (const line of original.lineItems) {
      await prisma.stpInvoiceLineItem.create({
        data: {
          invoiceId: creditNote.id,
          sortOrder: line.sortOrder,
          description: line.description,
          quantity: line.quantity,
          unitPrice: -line.unitPrice,
          amount: -line.amount,
          taxRate: line.taxRate,
          taxRateCategory: line.taxRateCategory,
        },
      });
    }
  }

  revalidatePath("/stp/finance/invoices");
  return creditNote;
}

// 明細行から税率ごとの合計を再計算
export async function recalcInvoiceTotals(invoiceId: number) {
  await requireEdit("stp");
  const lineItems = await prisma.stpInvoiceLineItem.findMany({
    where: { invoiceId },
  });

  if (lineItems.length === 0) return;

  const summary = calcInvoiceTaxSummary(
    lineItems.map((item) => ({
      amount: item.amount,
      taxRate: item.taxRate,
    }))
  );

  const { totalAmount, taxAmount } = calcInvoiceTotalFromSummary(summary);

  await prisma.stpInvoice.update({
    where: { id: invoiceId },
    data: { totalAmount, taxAmount },
  });

  revalidatePath("/stp/finance/invoices");
}
