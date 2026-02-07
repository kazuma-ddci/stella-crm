"use server";

import { prisma } from "@/lib/prisma";

// INV-YYYYMM-NNNN 形式の採番。$transactionで排他制御
export async function generateInvoiceNumber(): Promise<string> {
  const now = new Date();
  const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const result = await prisma.$transaction(async (tx) => {
    const seq = await tx.stpInvoiceNumberSequence.upsert({
      where: { yearMonth },
      create: { yearMonth, lastNumber: 1 },
      update: { lastNumber: { increment: 1 } },
    });
    return seq.lastNumber;
  });

  return `INV-${yearMonth.replace("-", "")}-${String(result).padStart(4, "0")}`;
}
