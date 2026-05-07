"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { ok, err, type ActionResult } from "@/lib/action-result";
import { requireStaffForAccounting } from "@/lib/auth/staff-action";
import {
  BANK_STATEMENT_FORMATS,
  isBankStatementFormatId,
} from "@/lib/accounting/statements/formats";
import { attachDedupHashes } from "@/lib/accounting/statements/dedup";

export type ImportStatementInput = {
  operatingCompanyId: number;
  operatingCompanyBankAccountId: number;
  bankFormatId: string;
  fileName: string;
  /** クライアント側で UTF-8 / Shift-JIS の自動判定を済ませたテキスト */
  csvText: string;
};

export type ImportStatementSummary = {
  importId: number;
  totalRowsParsed: number;
  inserted: number;
  duplicates: number;
  skippedLines: number;
  parseErrors: { line: number; message: string }[];
};

export async function importStatementCsv(
  input: ImportStatementInput
): Promise<ActionResult<ImportStatementSummary>> {
  const session = await requireStaffForAccounting("edit");

  try {
    if (!isBankStatementFormatId(input.bankFormatId)) {
      return err("不明なCSVフォーマットです");
    }
    if (!input.operatingCompanyId || !input.operatingCompanyBankAccountId) {
      return err("法人と銀行口座を選択してください");
    }
    if (!input.csvText || input.csvText.trim() === "") {
      return err("CSVファイルが空です");
    }

    // 法人と銀行口座の整合性チェック（口座が指定法人に属しているか）
    const bankAccount = await prisma.operatingCompanyBankAccount.findUnique({
      where: { id: input.operatingCompanyBankAccountId },
      select: { id: true, operatingCompanyId: true, deletedAt: true },
    });
    if (!bankAccount || bankAccount.deletedAt) {
      return err("選択された銀行口座が見つかりません");
    }
    if (bankAccount.operatingCompanyId !== input.operatingCompanyId) {
      return err("選択された銀行口座は指定の法人に属していません");
    }

    const format = BANK_STATEMENT_FORMATS[input.bankFormatId];
    const parsed = format.parse(input.csvText);

    if (parsed.entries.length === 0) {
      return err(
        parsed.errors.length > 0
          ? `取込可能な行がありませんでした: ${parsed.errors[0].message}`
          : "取込可能な行がありませんでした"
      );
    }

    const withHashes = attachDedupHashes(parsed.entries);

    // 既存ハッシュ照会（同一銀行口座内）
    const hashes = withHashes.map((e) => e.dedupHash);
    const existing = await prisma.bankStatementEntry.findMany({
      where: {
        operatingCompanyBankAccountId: input.operatingCompanyBankAccountId,
        dedupHash: { in: hashes },
      },
      select: { dedupHash: true },
    });
    const existingSet = new Set(existing.map((r) => r.dedupHash));
    const newEntries = withHashes.filter((e) => !existingSet.has(e.dedupHash));
    const duplicateCount = withHashes.length - newEntries.length;

    // 1トランザクションで Import + Entries を作成
    const importRecord = await prisma.$transaction(async (tx) => {
      const created = await tx.bankStatementImport.create({
        data: {
          operatingCompanyId: input.operatingCompanyId,
          operatingCompanyBankAccountId: input.operatingCompanyBankAccountId,
          bankFormatId: input.bankFormatId,
          fileName: input.fileName.slice(0, 255),
          uploadedBy: session.id,
          rowCount: parsed.entries.length,
          insertedCount: newEntries.length,
          duplicateCount,
          openingBalance: parsed.openingBalance,
        },
      });

      if (newEntries.length > 0) {
        await tx.bankStatementEntry.createMany({
          data: newEntries.map((e) => ({
            importId: created.id,
            operatingCompanyId: input.operatingCompanyId,
            operatingCompanyBankAccountId:
              input.operatingCompanyBankAccountId,
            transactionDate: new Date(`${e.transactionDate}T00:00:00Z`),
            description: e.description,
            incomingAmount: e.incomingAmount,
            outgoingAmount: e.outgoingAmount,
            balance: e.balance,
            csvMemo: e.csvMemo,
            staffMemo: null,
            rowOrder: e.rowOrder,
            dedupHash: e.dedupHash,
          })),
          skipDuplicates: true,
        });
      }

      return created;
    });

    revalidatePath("/accounting/statements");
    revalidatePath("/accounting/statements/import");

    return ok({
      importId: importRecord.id,
      totalRowsParsed: parsed.entries.length,
      inserted: newEntries.length,
      duplicates: duplicateCount,
      skippedLines: parsed.skippedLines,
      parseErrors: parsed.errors,
    });
  } catch (e) {
    console.error("[importStatementCsv] error:", e);
    return err(
      e instanceof Error ? e.message : "CSV取込中にエラーが発生しました"
    );
  }
}
