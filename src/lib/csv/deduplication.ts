/**
 * Deduplication logic for bank transaction imports.
 * Uses SHA-256 hashing to detect duplicate transactions.
 */

import crypto from "crypto";
import { PrismaClient } from "@prisma/client";
import type { ParsedRow } from "./parser";

export type DuplicateCheckResult = {
  rowIndex: number;
  isDuplicate: boolean;
  matchingTransactionId?: number;
  hash: string;
};

/**
 * Generate a SHA-256 deduplication hash for a transaction.
 *
 * The hash is computed from: transactionDate + direction + amount + description + bankAccountName.
 * If sourceTransactionId is provided, it is used instead of description for more accurate dedup.
 */
export function generateDeduplicationHash(params: {
  transactionDate: string; // YYYY-MM-DD
  direction: string;
  amount: number;
  description: string;
  bankAccountName: string;
  sourceTransactionId?: string;
}): string {
  const key = params.sourceTransactionId
    ? `${params.transactionDate}|${params.direction}|${params.amount}|${params.sourceTransactionId}|${params.bankAccountName}`
    : `${params.transactionDate}|${params.direction}|${params.amount}|${params.description}|${params.bankAccountName}`;

  return crypto.createHash("sha256").update(key, "utf-8").digest("hex");
}

/**
 * Check parsed rows against existing DB records for duplicates.
 *
 * Strategy:
 * 1. Compute hashes for all parsed rows
 * 2. Query existing transactions in the same date range and bank account
 * 3. Compare hashes to find duplicates
 */
export async function checkDuplicates(
  rows: ParsedRow[],
  bankAccountName: string,
  prisma: PrismaClient
): Promise<DuplicateCheckResult[]> {
  if (rows.length === 0) return [];

  // Compute hashes for all rows
  const rowHashes = rows.map((row) => ({
    rowIndex: row.rawRowIndex,
    hash: generateDeduplicationHash({
      transactionDate: row.date,
      direction: row.direction,
      amount: row.amount,
      description: row.description,
      bankAccountName,
    }),
  }));

  // Determine date range for DB query
  const dates = rows.map((r) => r.date).sort();
  const minDate = dates[0];
  const maxDate = dates[dates.length - 1];

  // Query existing transactions in the date range for this bank account
  const existingTransactions = await prisma.accountingTransaction.findMany({
    where: {
      bankAccountName,
      transactionDate: {
        gte: new Date(minDate),
        lte: new Date(maxDate),
      },
      deduplicationHash: { not: null },
    },
    select: {
      id: true,
      deduplicationHash: true,
    },
  });

  // Build a map of existing hashes to transaction IDs
  const existingHashMap = new Map<string, number>();
  for (const tx of existingTransactions) {
    if (tx.deduplicationHash) {
      existingHashMap.set(tx.deduplicationHash, tx.id);
    }
  }

  // Also check for duplicates within the import batch itself
  const seenHashes = new Map<string, number>(); // hash -> first rowIndex

  // Check each row
  return rowHashes.map(({ rowIndex, hash }) => {
    // Check against DB
    const matchingId = existingHashMap.get(hash);
    if (matchingId !== undefined) {
      return {
        rowIndex,
        isDuplicate: true,
        matchingTransactionId: matchingId,
        hash,
      };
    }

    // Check against already-seen rows in this batch (intra-batch dedup)
    if (seenHashes.has(hash)) {
      return {
        rowIndex,
        isDuplicate: true,
        hash,
      };
    }

    seenHashes.set(hash, rowIndex);
    return {
      rowIndex,
      isDuplicate: false,
      hash,
    };
  });
}
