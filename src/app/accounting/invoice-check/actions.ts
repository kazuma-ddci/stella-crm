"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { ok, err, type ActionResult } from "@/lib/action-result";
import { requireStaffForAccounting } from "@/lib/auth/staff-action";

export type InvoiceMismatchGroup = {
  counterparty: {
    id: number;
    displayId: string | null;
    name: string;
    invoiceEffectiveDate: Date;
  };
  journals: {
    id: number;
    journalDate: Date;
    description: string;
    status: string;
    lines: {
      id: number;
      side: string;
      accountId: number;
      amount: number;
      taxClassification: string | null;
      taxAmount: number | null;
      account: { name: string };
    }[];
  }[];
};

export async function getInvoiceMismatchedJournals(): Promise<InvoiceMismatchGroup[]> {
  // 認証: 経理プロジェクトの閲覧権限以上
  await requireStaffForAccounting("view");

  // 1. インボイス登録済み＋適用日ありの取引先
  const counterparties = await prisma.counterparty.findMany({
    where: {
      isInvoiceRegistered: true,
      invoiceEffectiveDate: { not: null },
      deletedAt: null,
    },
    select: { id: true, displayId: true, name: true, invoiceEffectiveDate: true },
  });

  // 2. 各取引先について、適用日以降の「インボイスなし」仕訳を検索
  const results: InvoiceMismatchGroup[] = [];
  for (const cp of counterparties) {
    const journals = await prisma.journalEntry.findMany({
      where: {
        counterpartyId: cp.id,
        hasInvoice: false,
        journalDate: { gte: cp.invoiceEffectiveDate! },
        deletedAt: null,
        lines: {
          some: {
            taxClassification: { in: ["taxable_10_no_invoice", "taxable_8_no_invoice"] },
          },
        },
      },
      select: {
        id: true,
        journalDate: true,
        description: true,
        status: true,
        lines: {
          select: {
            id: true,
            side: true,
            accountId: true,
            amount: true,
            taxClassification: true,
            taxAmount: true,
            account: { select: { name: true } },
          },
        },
      },
      orderBy: { journalDate: "asc" },
    });
    if (journals.length > 0) {
      results.push({
        counterparty: {
          id: cp.id,
          displayId: cp.displayId,
          name: cp.name,
          invoiceEffectiveDate: cp.invoiceEffectiveDate!,
        },
        journals,
      });
    }
  }
  return results;
}

export async function bulkUpdateInvoiceClassification(
  journalEntryIds: number[]
): Promise<ActionResult<void>> {
  try {
    if (journalEntryIds.length === 0) return ok();

    await prisma.$transaction(async (tx) => {
      for (const id of journalEntryIds) {
        await tx.journalEntry.update({
          where: { id },
          data: { hasInvoice: true },
        });
        await tx.journalEntryLine.updateMany({
          where: { journalEntryId: id, taxClassification: "taxable_10_no_invoice" },
          data: { taxClassification: "taxable_10" },
        });
        await tx.journalEntryLine.updateMany({
          where: { journalEntryId: id, taxClassification: "taxable_8_no_invoice" },
          data: { taxClassification: "taxable_8" },
        });
      }
    });

    revalidatePath("/accounting/invoice-check");
    return ok();
  } catch (e) {
    console.error("[bulkUpdateInvoiceClassification] error:", e);
    return err(
      e instanceof Error ? e.message : "税区分の一括更新に失敗しました"
    );
  }
}
