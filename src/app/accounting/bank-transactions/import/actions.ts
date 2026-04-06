"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { BANK_FORMATS, getFormatOptions } from "@/lib/csv/bank-formats";
import { parseCsvBuffer } from "@/lib/csv/parser";
import { checkDuplicates, generateDeduplicationHash } from "@/lib/csv/deduplication";

// ============================================
// Types
// ============================================

export type ImportFormData = {
  operatingCompanies: { id: number; companyName: string }[];
  bankFormats: { id: string; bankName: string }[];
};

export type PreviewRow = {
  rowIndex: number;
  date: string;
  description: string;
  incoming: number;
  outgoing: number;
  balance: number | null;
  memo: string;
  direction: string;
  amount: number;
  isDuplicate: boolean;
  matchingTransactionId?: number;
  hasError: boolean;
  errors: string[];
  hash: string;
  selected: boolean;
};

export type ParseActionResult = {
  success: boolean;
  error?: string;
  rows?: PreviewRow[];
  summary?: {
    total: number;
    newCount: number;
    duplicateCount: number;
    errorCount: number;
  };
};

export type ConfirmImportData = {
  rows: {
    date: string;
    description: string;
    incoming: number;
    outgoing: number;
    balance: number | null;
    memo: string;
    direction: string;
    amount: number;
    hash: string;
  }[];
  operatingCompanyId: number;
  bankAccountName: string;
  formatId: string;
  fileName: string;
};

export type ConfirmImportResult = {
  success: boolean;
  error?: string;
  batchId?: number;
  newCount?: number;
};

// ============================================
// Server Actions
// ============================================

/**
 * Get operating companies and bank format options for the import form.
 */
export async function getImportFormData(): Promise<ImportFormData> {
  const operatingCompanies = await prisma.operatingCompany.findMany({
    where: { isActive: true },
    select: { id: true, companyName: true },
  });

  const formatOptions = getFormatOptions();
  const bankFormats = formatOptions.map((f) => ({
    id: f.id,
    bankName: f.label,
  }));

  return { operatingCompanies, bankFormats };
}

/**
 * Parse an uploaded CSV file and check for duplicates.
 */
export async function parseCsvAction(
  formData: FormData
): Promise<ParseActionResult> {
  try {
    const file = formData.get("file") as File | null;
    const formatId = formData.get("formatId") as string | null;
    const operatingCompanyId = Number(formData.get("operatingCompanyId"));
    const bankAccountName = formData.get("bankAccountName") as string | null;

    if (!file || file.size === 0) {
      return { success: false, error: "CSVファイルを選択してください。" };
    }
    if (!formatId || !BANK_FORMATS[formatId]) {
      return { success: false, error: "銀行フォーマットを選択してください。" };
    }
    if (!operatingCompanyId) {
      return { success: false, error: "法人を選択してください。" };
    }
    if (!bankAccountName || bankAccountName.trim() === "") {
      return { success: false, error: "銀行口座名を入力してください。" };
    }

    const format = BANK_FORMATS[formatId];

    // Convert File to Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Parse CSV
    const parseResult = parseCsvBuffer(buffer, format);

    if (parseResult.rows.length === 0) {
      return {
        success: false,
        error: "CSVファイルから取引データを読み取れませんでした。フォーマットを確認してください。",
      };
    }

    // Check duplicates
    const duplicateResults = await checkDuplicates(
      parseResult.rows,
      bankAccountName.trim(),
      prisma
    );

    // Build preview rows
    const previewRows: PreviewRow[] = parseResult.rows.map((row, index) => {
      const dupResult = duplicateResults[index];
      const hasError = row.errors.length > 0;
      const isDuplicate = dupResult?.isDuplicate ?? false;

      return {
        rowIndex: row.rawRowIndex,
        date: row.date,
        description: row.description,
        incoming: row.incoming,
        outgoing: row.outgoing,
        balance: row.balance,
        memo: row.memo,
        direction: row.direction,
        amount: row.amount,
        isDuplicate,
        matchingTransactionId: dupResult?.matchingTransactionId,
        hasError,
        errors: row.errors,
        hash: dupResult?.hash ?? "",
        selected: !isDuplicate && !hasError,
      };
    });

    const duplicateCount = previewRows.filter((r) => r.isDuplicate).length;
    const errorCount = previewRows.filter((r) => r.hasError).length;
    const newCount = previewRows.filter(
      (r) => !r.isDuplicate && !r.hasError
    ).length;

    return {
      success: true,
      rows: previewRows,
      summary: {
        total: previewRows.length,
        newCount,
        duplicateCount,
        errorCount,
      },
    };
  } catch (error) {
    console.error("CSV parse error:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? `CSV解析エラー: ${error.message}`
          : "CSV解析中に予期せぬエラーが発生しました。",
    };
  }
}

/**
 * Confirm and save selected rows to the database.
 */
export async function confirmImport(
  data: ConfirmImportData
): Promise<ConfirmImportResult> {
  try {
    const session = await getSession();

    if (data.rows.length === 0) {
      return { success: false, error: "取込対象の行がありません。" };
    }

    // Determine date range
    const dates = data.rows.map((r) => r.date).sort();
    const periodFrom = dates[0];
    const periodTo = dates[dates.length - 1];

    // Create batch and transactions in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create import batch
      const batch = await tx.accountingImportBatch.create({
        data: {
          source: "bank_csv",
          sourceService: data.formatId,
          fileName: data.fileName,
          periodFrom: new Date(periodFrom),
          periodTo: new Date(periodTo),
          totalCount: data.rows.length,
          newCount: data.rows.length,
          duplicateCount: 0,
          status: "processing",
          importedBy: session.id,
        },
      });

      // Create transactions
      await tx.accountingTransaction.createMany({
        data: data.rows.map((row) => ({
          direction: row.direction,
          transactionDate: new Date(row.date),
          amount: row.amount,
          counterpartyName: row.description,
          description: row.description,
          memo: row.memo || null,
          balance: row.balance,
          bankAccountName: data.bankAccountName,
          source: "bank_csv",
          sourceService: data.formatId,
          importBatchId: batch.id,
          operatingCompanyId: data.operatingCompanyId,
          deduplicationHash: row.hash,
          reconciliationStatus: "unmatched",
        })),
      });

      // Update batch status
      await tx.accountingImportBatch.update({
        where: { id: batch.id },
        data: {
          status: "completed",
          newCount: data.rows.length,
        },
      });

      return { batchId: batch.id, newCount: data.rows.length };
    });

    revalidatePath("/accounting/bank-transactions");
    revalidatePath("/accounting/bank-transactions/history");

    return {
      success: true,
      batchId: result.batchId,
      newCount: result.newCount,
    };
  } catch (error) {
    console.error("Import confirm error:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? `取込エラー: ${error.message}`
          : "取込中に予期せぬエラーが発生しました。",
    };
  }
}
