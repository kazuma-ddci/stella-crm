"use server";

import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

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

// 法人別採番: {abbreviation}-INV-{YYYYMM}-{NNNN}
// トランザクション内で排他制御。txが渡された場合はそのトランザクション内で実行
export async function generateInvoiceGroupNumber(
  operatingCompanyId: number,
  tx?: Prisma.TransactionClient
): Promise<string> {
  const client = tx ?? prisma;
  const now = new Date();
  const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const company = await client.operatingCompany.findUniqueOrThrow({
    where: { id: operatingCompanyId },
    select: { abbreviation: true },
  });
  const prefix = company.abbreviation || "UNK";

  const existing = await client.stpInvoiceNumberSequence.findFirst({
    where: { yearMonth, operatingCompanyId },
  });

  let seqNum: number;
  if (existing) {
    const updated = await client.stpInvoiceNumberSequence.update({
      where: { id: existing.id },
      data: { lastNumber: { increment: 1 } },
    });
    seqNum = updated.lastNumber;
  } else {
    const created = await client.stpInvoiceNumberSequence.create({
      data: { yearMonth, operatingCompanyId, lastNumber: 1 },
    });
    seqNum = created.lastNumber;
  }

  return `${prefix}-INV-${yearMonth.replace("-", "")}-${String(seqNum).padStart(4, "0")}`;
}
