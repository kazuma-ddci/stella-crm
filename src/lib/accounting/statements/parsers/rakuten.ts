/**
 * 楽天銀行 入出金CSV パーサ
 *
 * ヘッダ: 取引日,入出金(円),残高(円),入出金先内容
 *  - 入出金は符号付きの単一列。負=出金、正=入金。
 *  - 日付は YYYYMMDD 8桁。
 *  - メモ列は無し（CSVメモは null 固定）。
 *
 * サンプル (アドア楽天㉙.csv):
 *   取引日,入出金(円),残高(円),入出金先内容
 *   20260330,-2446000,54621,みんなの銀行...
 */

import Papa from "papaparse";
import type { ParseStatementResult, ParsedStatementEntry } from "../types";
import {
  normalizeText,
  parseAmountToInt,
  parseDate8,
} from "../format-helpers";

export function parseRakutenCsv(csvText: string): ParseStatementResult {
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

    const date = parseDate8(row[0]);
    if (!date) {
      skippedLines++; // ヘッダ "取引日" 行など
      continue;
    }

    const signed = parseAmountToInt(row[1]);
    const balance = parseAmountToInt(row[2]);
    const description = (row[3] ?? "").trim();

    if (signed === null) {
      skippedLines++;
      continue;
    }
    if (!description) {
      errors.push({ line: lineNo, message: "摘要が空です" });
    }

    let incoming: number | null = null;
    let outgoing: number | null = null;
    if (signed >= 0) {
      incoming = signed;
    } else {
      outgoing = Math.abs(signed);
    }

    entries.push({
      transactionDate: date,
      description,
      incomingAmount: incoming,
      outgoingAmount: outgoing,
      balance,
      csvMemo: null,
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
