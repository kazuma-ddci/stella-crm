/**
 * 全銀フォーマット 入出金CSV パーサ（三井住友銀行などが提供する標準形式）
 *
 * 多レコード型:
 *   データ区分 = 1: ヘッダレコード（口座情報・期間・取引前残高 col16）
 *   データ区分 = 2: データレコード（個別取引）
 *   データ区分 = 8: トレーラレコード（件数合計）
 *   データ区分 = 9: エンドレコード
 *
 * 行頭が "データ区分" で始まる場合（カラム定義行）はスキップ。
 *
 * データレコードの列構成:
 *   0: データ区分(=2)  1: 照会番号  2: 勘定日(YYMMDD)
 *   3: 預入・払出日   4: 入払区分(1=入金/2=出金/3=訂正入金/4=訂正出金)
 *   5: 取引区分      6: 取引金額(12桁ゼロ埋め)  7: うち他店券金額
 *   8: 交換呈示日   9: 不渡返還日   10: 手形・小切手区分   11: 手形・小切手番号
 *   12: 僚店番号    13: 振込依頼人コード
 *   14: 振込依頼人名 15: 仕向銀行名 16: 仕向支店名
 *   17: 摘要内容    18: EDI情報    19: ダミー
 *
 * 残高は CSV に含まれないため、ヘッダの「取引前残高」を起点に running balance を計算する。
 * 複数口座を含むファイルが渡された場合は最初のヘッダのみを採用し、警告を errors に追加する。
 */

import Papa from "papaparse";
import type { ParseStatementResult, ParsedStatementEntry } from "../types";
import { normalizeText, parseDate6 } from "../format-helpers";

export function parseZenginMitsuiCsv(csvText: string): ParseStatementResult {
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
  let openingBalance: number | null = null;
  let runningBalance: number | null = null;
  let headerSeen = false;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const lineNo = i + 1;
    if (!row || row.every((c) => !c || c.trim() === "")) {
      skippedLines++;
      continue;
    }

    const dataKubun = (row[0] ?? "").trim();

    // カラム定義ヘッダ行 / "データ区分" の文字行 はスキップ
    if (!/^\d+$/.test(dataKubun)) {
      skippedLines++;
      continue;
    }

    if (dataKubun === "1") {
      // ヘッダレコード
      const balanceRaw = (row[16] ?? "").trim().replace(/^0+(?=\d)/, "");
      const bal = balanceRaw === "" ? NaN : Number(balanceRaw);
      if (Number.isFinite(bal)) {
        if (!headerSeen) {
          openingBalance = Math.trunc(bal);
          runningBalance = openingBalance;
          headerSeen = true;
        } else {
          errors.push({
            line: lineNo,
            message:
              "複数のヘッダレコードを検出しました（複数口座のCSVは未対応）。最初のヘッダのみを採用します",
          });
        }
      } else {
        errors.push({
          line: lineNo,
          message: "ヘッダレコードの取引前残高を解析できませんでした",
        });
      }
      skippedLines++;
      continue;
    }

    if (dataKubun !== "2") {
      // 8: トレーラ, 9: エンド, その他はスキップ
      skippedLines++;
      continue;
    }

    if (!headerSeen) {
      errors.push({
        line: lineNo,
        message:
          "ヘッダレコードよりも先にデータレコードが現れたため残高計算ができません",
      });
    }

    const date = parseDate6(row[2]);
    if (!date) {
      errors.push({ line: lineNo, message: "勘定日の形式が不正です" });
      continue;
    }

    const flow = (row[4] ?? "").trim();
    const isIncoming = flow === "1" || flow === "3"; // 入金 or 訂正入金
    const isOutgoing = flow === "2" || flow === "4"; // 出金 or 訂正出金
    if (!isIncoming && !isOutgoing) {
      errors.push({
        line: lineNo,
        message: `入払区分 "${flow}" を解釈できません`,
      });
      continue;
    }

    // 12桁ゼロ埋めの先頭ゼロを落として整数化
    const amountRaw = (row[6] ?? "").trim().replace(/^0+(?=\d)/, "");
    const amount = amountRaw === "" ? 0 : Math.trunc(Number(amountRaw));
    if (!Number.isFinite(amount) || amount <= 0) {
      errors.push({ line: lineNo, message: "取引金額の解析に失敗しました" });
      continue;
    }

    const summary = (row[17] ?? "").trim();
    const requester = (row[14] ?? "").trim();
    const description = [summary, requester].filter(Boolean).join(" ");

    let balance: number | null = null;
    if (runningBalance !== null) {
      runningBalance = isIncoming
        ? runningBalance + amount
        : runningBalance - amount;
      balance = runningBalance;
    }

    entries.push({
      transactionDate: date,
      description,
      incomingAmount: isIncoming ? amount : null,
      outgoingAmount: isOutgoing ? amount : null,
      balance,
      csvMemo: null,
      rowOrder: rowOrder++,
    });
  }

  return {
    entries,
    openingBalance,
    totalLines: rows.length,
    skippedLines,
    errors,
  };
}
