/**
 * CSV parser for bank transaction history imports.
 * Handles Shift-JIS encoding and various Japanese bank CSV formats.
 */

import iconv from "iconv-lite";
import Papa from "papaparse";
import { BankCsvFormat } from "./bank-formats";

export type ParsedRow = {
  date: string; // normalized to YYYY-MM-DD
  description: string;
  incoming: number;
  outgoing: number;
  balance: number | null;
  memo: string;
  direction: "incoming" | "outgoing";
  amount: number; // absolute amount (always positive)
  rawRowIndex: number; // original row index in the CSV (0-based, before header skip)
  errors: string[];
};

export type ParseResult = {
  rows: ParsedRow[];
  totalRowsRead: number;
  skippedRows: number;
  errorRows: number;
};

/**
 * Parse a numeric string: remove commas, handle negative signs, full-width chars.
 * Returns 0 for empty/invalid strings.
 */
function parseAmount(raw: string | undefined | null): number {
  if (!raw || raw.trim() === "" || raw.trim() === "-") return 0;

  // Normalize full-width digits and signs to half-width
  let normalized = raw
    .replace(/[０-９]/g, (ch) =>
      String.fromCharCode(ch.charCodeAt(0) - 0xfee0)
    )
    .replace(/，/g, ",")
    .replace(/−/g, "-")
    .replace(/,/g, "")
    .trim();

  // Remove surrounding quotes if present
  normalized = normalized.replace(/^["']|["']$/g, "");

  const num = Number(normalized);
  return isNaN(num) ? 0 : num;
}

/**
 * Parse a date string according to the given format and normalize to YYYY-MM-DD.
 * Returns null if parsing fails.
 */
function parseDate(raw: string, dateFormat: string): string | null {
  if (!raw || raw.trim() === "") return null;

  let cleaned = raw.trim();

  // Normalize full-width digits
  cleaned = cleaned.replace(/[０-９]/g, (ch) =>
    String.fromCharCode(ch.charCodeAt(0) - 0xfee0)
  );

  let year: string;
  let month: string;
  let day: string;

  if (dateFormat === "YYYY年MM月DD日") {
    const match = cleaned.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
    if (!match) return null;
    [, year, month, day] = match;
  } else if (dateFormat === "YYYY-MM-DD") {
    const match = cleaned.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (!match) return null;
    [, year, month, day] = match;
  } else {
    // Default: YYYY/MM/DD
    const match = cleaned.match(/(\d{4})[/\-.](\d{1,2})[/\-.](\d{1,2})/);
    if (!match) return null;
    [, year, month, day] = match;
  }

  const y = parseInt(year, 10);
  const m = parseInt(month, 10);
  const d = parseInt(day, 10);

  // Basic validation
  if (y < 1900 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) {
    return null;
  }

  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/**
 * Get a cell value from a row, returning empty string for out-of-bounds.
 */
function getCell(row: string[], index: number | undefined): string {
  if (index === undefined || index < 0 || index >= row.length) return "";
  return (row[index] ?? "").trim();
}

/**
 * Parse a CSV file buffer using the given bank format.
 */
export function parseCsvBuffer(
  buffer: Buffer,
  format: BankCsvFormat
): ParseResult {
  // Decode buffer based on encoding
  let csvText: string;
  if (format.encoding === "shift-jis") {
    csvText = iconv.decode(buffer, "Shift_JIS");
  } else {
    csvText = buffer.toString("utf-8");
  }

  // Remove BOM if present
  if (csvText.charCodeAt(0) === 0xfeff) {
    csvText = csvText.slice(1);
  }

  // Parse CSV
  const parseResult = Papa.parse<string[]>(csvText, {
    header: false,
    skipEmptyLines: true,
  });

  const allRows = parseResult.data;
  const dataRows = allRows.slice(format.headerRows);

  const isMoneyforward = format.id === "moneyforward";
  const rows: ParsedRow[] = [];
  let skippedRows = 0;
  let errorRows = 0;

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i];
    const rawRowIndex = i + format.headerRows;
    const errors: string[] = [];

    // Skip completely empty rows
    if (!row || row.every((cell) => !cell || cell.trim() === "")) {
      skippedRows++;
      continue;
    }

    // Parse date
    const rawDate = getCell(row, format.columns.date);
    const date = parseDate(rawDate, format.dateFormat);
    if (!date) {
      // If the row has no valid date, it's likely a footer or summary row - skip it
      skippedRows++;
      continue;
    }

    // Parse description
    const description = getCell(row, format.columns.description);

    // Parse amounts
    let incoming: number;
    let outgoing: number;

    if (isMoneyforward) {
      // MoneyForward: single column, positive = incoming, negative = outgoing
      const rawAmount = parseAmount(getCell(row, format.columns.incoming));
      if (rawAmount >= 0) {
        incoming = rawAmount;
        outgoing = 0;
      } else {
        incoming = 0;
        outgoing = Math.abs(rawAmount);
      }
    } else {
      incoming = parseAmount(getCell(row, format.columns.incoming));
      outgoing = parseAmount(getCell(row, format.columns.outgoing));

      // Ensure amounts are non-negative
      incoming = Math.abs(incoming);
      outgoing = Math.abs(outgoing);
    }

    // Skip rows where both amounts are zero (no transaction)
    if (incoming === 0 && outgoing === 0) {
      skippedRows++;
      continue;
    }

    // Parse balance
    const rawBalance = getCell(row, format.columns.balance);
    const balance = rawBalance ? parseAmount(rawBalance) : null;

    // Parse memo
    const memo = getCell(row, format.columns.memo);

    // Determine direction and amount
    const direction: "incoming" | "outgoing" =
      incoming > 0 ? "incoming" : "outgoing";
    const amount = incoming > 0 ? incoming : outgoing;

    // Validation
    if (!description) {
      errors.push(`行${rawRowIndex + 1}: 摘要が空です`);
    }
    if (incoming > 0 && outgoing > 0) {
      errors.push(
        `行${rawRowIndex + 1}: 入金・出金の両方に金額があります`
      );
    }

    if (errors.length > 0) {
      errorRows++;
    }

    rows.push({
      date,
      description,
      incoming,
      outgoing,
      balance,
      memo,
      direction,
      amount,
      rawRowIndex,
      errors,
    });
  }

  return {
    rows,
    totalRowsRead: dataRows.length,
    skippedRows,
    errorRows,
  };
}
