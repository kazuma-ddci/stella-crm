/**
 * 標準CSV（手動作成用）パーサ。
 *
 * 銀行CSVが取れない通帳運用の口座向けに、手入力で整えたCSVを取り込む。
 * 列順:
 *   日付, 摘要, 入金, 出金, 残高, メモ
 *
 * 日付は YYYY-MM-DD / YYYY/MM/DD / YYYYMMDD に対応。
 */

import Papa from "papaparse";
import type { ParseStatementResult, ParsedStatementEntry } from "../types";
import {
  normalizeMemo,
  normalizeText,
  parseAmountToInt,
  parseDate8,
  parseDateSlash,
} from "../format-helpers";

function positiveAmountOrNull(value: number | null): number | null {
  if (value === null || value === 0) return null;
  return value;
}

export function parseManualStandardCsv(csvText: string): ParseStatementResult {
  const text = normalizeText(csvText);
  const result = Papa.parse<string[]>(text, {
    header: false,
    skipEmptyLines: true,
  });
  const rows = result.data;
  const errors: ParseStatementResult["errors"] = [];
  const entries: ParsedStatementEntry[] = [];
  let skippedLines = 0;
  let rowOrder = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const lineNo = i + 1;
    if (!row || row.every((c) => !c || c.trim() === "")) {
      skippedLines++;
      continue;
    }

    const date = parseDateSlash(row[0]) ?? parseDate8(row[0]);
    if (!date) {
      skippedLines++;
      continue;
    }

    const description = (row[1] ?? "").trim();
    const incoming = positiveAmountOrNull(parseAmountToInt(row[2]));
    const outgoing = positiveAmountOrNull(parseAmountToInt(row[3]));
    const balance = parseAmountToInt(row[4]);
    const csvMemo = normalizeMemo(row[5]);

    if (!description) {
      errors.push({ line: lineNo, message: "摘要が空です" });
    }
    if (incoming !== null && incoming < 0) {
      errors.push({ line: lineNo, message: "入金は0以上で入力してください" });
      skippedLines++;
      continue;
    }
    if (outgoing !== null && outgoing < 0) {
      errors.push({ line: lineNo, message: "出金は0以上で入力してください" });
      skippedLines++;
      continue;
    }
    if (incoming !== null && outgoing !== null) {
      errors.push({
        line: lineNo,
        message: "入金と出金はどちらか一方だけ入力してください",
      });
      skippedLines++;
      continue;
    }
    if (incoming === null && outgoing === null) {
      skippedLines++;
      continue;
    }

    entries.push({
      transactionDate: date,
      description,
      incomingAmount: incoming,
      outgoingAmount: outgoing,
      balance,
      csvMemo,
      rowOrder: rowOrder++,
    });
  }

  return {
    entries,
    openingBalance: null,
    totalLines: rows.length,
    skippedLines,
    errors,
  };
}
