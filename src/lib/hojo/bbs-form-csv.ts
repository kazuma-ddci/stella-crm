// BBS社向けCSV出力。Googleフォーム→スプレッドシート完全互換のフォーマット:
//   1列目: 「タイムスタンプ」（formTranscriptDate）
//   2列目以降: BBS_FORM_QUESTIONS の title をそのまま列名（31列）
//   1行 = 1回答
// Stella管理用カラム（ID/UID/申請者名/確定日時等）は出さない。

import Papa from "papaparse";
import { BBS_FORM_QUESTIONS } from "./bbs-form-structure";
import { buildBbsFormResponse, type FileInfo } from "./bbs-form-mapping";

export type BbsFormCsvRow = {
  formTranscriptDate: Date;
  answers: Record<string, unknown>;
  modifiedAnswers: Record<string, unknown> | null;
  fileUrls: Record<string, FileInfo> | null;
};

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

// Googleフォームスプレッドシートの慣習: 「YYYY/MM/DD HH:mm:ss」JST
function formatTimestampJst(d: Date): string {
  const jst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  const y = jst.getUTCFullYear();
  const m = pad2(jst.getUTCMonth() + 1);
  const day = pad2(jst.getUTCDate());
  const hh = pad2(jst.getUTCHours());
  const mm = pad2(jst.getUTCMinutes());
  const ss = pad2(jst.getUTCSeconds());
  return `${y}/${m}/${day} ${hh}:${mm}:${ss}`;
}

export function buildBbsFormCsv(rows: BbsFormCsvRow[]): string {
  const headers: string[] = [
    "タイムスタンプ",
    ...BBS_FORM_QUESTIONS.map((q) => q.title),
  ];

  const data: string[][] = rows.map((row) => {
    const responses = buildBbsFormResponse({
      answers: row.answers,
      modifiedAnswers: row.modifiedAnswers,
      fileUrls: row.fileUrls,
    });
    return [formatTimestampJst(row.formTranscriptDate), ...responses.map((r) => r.value)];
  });

  const csv = Papa.unparse({ fields: headers, data }, { quotes: true });
  // BOM付きUTF-8（Excelで文字化け回避）
  return "﻿" + csv;
}
