/**
 * GMOあおぞらネット銀行 入出金CSV パーサ
 *
 * ヘッダ: "日付","摘要","入金金額","出金金額","残高","メモ"
 * 注意: 住信SBIと逆で 入金 が 出金 より左。
 * 日付は YYYYMMDD 8桁、金額はカンマなし。
 *
 * サンプル (StellaGMO㉙.csv):
 *   "日付","摘要","入金金額","出金金額","残高","メモ"
 *   "20260403","振込手数料","","143","2436139",""
 */

import Papa from "papaparse";
import type { ParseStatementResult, ParsedStatementEntry } from "../types";
import {
  normalizeMemo,
  normalizeText,
  parseAmountToInt,
  parseDate8,
} from "../format-helpers";

export function parseGmoAozoraCsv(csvText: string): ParseStatementResult {
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
      skippedLines++;
      continue;
    }

    const description = (row[1] ?? "").trim();
    const incoming = parseAmountToInt(row[2]);
    const outgoing = parseAmountToInt(row[3]);
    const balance = parseAmountToInt(row[4]);
    const csvMemo = normalizeMemo(row[5]);

    if (incoming === null && outgoing === null) {
      skippedLines++;
      continue;
    }
    if (!description) {
      errors.push({ line: lineNo, message: "摘要が空です" });
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
