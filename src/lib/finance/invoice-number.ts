"use server";

import { prisma } from "@/lib/prisma";

// INV-YYYYMM-NNNN 形式の採番。$transactionで排他制御
// STP既存用（operatingCompanyId なし）
export async function generateInvoiceNumber(): Promise<string> {
  const now = new Date();
  const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const result = await prisma.$transaction(async (tx) => {
    // operatingCompanyId=null の既存STP用レコードを検索・更新
    const existing = await tx.stpInvoiceNumberSequence.findFirst({
      where: { yearMonth, operatingCompanyId: null },
    });
    if (existing) {
      const updated = await tx.stpInvoiceNumberSequence.update({
        where: { id: existing.id },
        data: { lastNumber: { increment: 1 } },
      });
      return updated.lastNumber;
    }
    const created = await tx.stpInvoiceNumberSequence.create({
      data: { yearMonth, lastNumber: 1 },
    });
    return created.lastNumber;
  });

  return `INV-${yearMonth.replace("-", "")}-${String(result).padStart(4, "0")}`;
}
