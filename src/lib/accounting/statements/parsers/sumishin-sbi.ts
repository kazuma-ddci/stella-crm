/**
 * 住信SBIネット銀行 入出金CSV パーサ
 *
 * ヘッダ: "日付","内容","出金金額(円)","入金金額(円)","残高(円)","メモ"
 * 注意: 出金が入金よりも左の列。
 *
 * サンプル (AEON住信⑲.csv):
 *   "日付","内容","出金金額(円)","入金金額(円)","残高(円)","メモ"
 *   "2026/01/09","振込＊タカハシ　ユウキ",,"15,700,000","18,165,030","-"
 */

import Papa from "papaparse";
import type { ParseStatementResult, ParsedStatementEntry } from "../types";
import {
  normalizeMemo,
  normalizeText,
  parseAmountToInt,
  parseDateSlash,
} from "../format-helpers";

export function parseSumishinSbiCsv(csvText: string): ParseStatementResult {
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

    const date = parseDateSlash(row[0]);
    if (!date) {
      // ヘッダ行や末尾サマリ行は自動的にスキップ
      skippedLines++;
      continue;
    }

    const description = (row[1] ?? "").trim();
    const outgoing = parseAmountToInt(row[2]);
    const incoming = parseAmountToInt(row[3]);
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
