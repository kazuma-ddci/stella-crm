import Papa from "papaparse";
import {
  INDIVIDUAL_LOAN_SECTIONS,
  CORPORATE_LOAN_SECTIONS,
  getCorporateBOSections,
  type LoanFormSection,
} from "./loan-form-fields";

export type LoanSubmissionCsvRow = {
  id: number;
  formType: string; // "loan-corporate" | "loan-individual"
  submittedAt: Date | string;
  vendorName: string;
  companyName: string;
  representName: string;
  email: string;
  phone: string;
  vendorMemo?: string;
  lenderMemo?: string;
  staffMemo?: string;
  answers: Record<string, unknown>;
  modifiedAnswers: Record<string, unknown> | null;
};

function formatDateTime(d: Date | string | null | undefined): string {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" });
}

function pickAnswer(
  answers: Record<string, unknown>,
  modified: Record<string, unknown> | null,
  key: string,
): string {
  if (modified && modified[key] !== undefined && modified[key] !== null && modified[key] !== "") {
    return String(modified[key]);
  }
  const v = answers[key];
  if (v === undefined || v === null) return "";
  return String(v);
}

/**
 * 選択された借入申込フォーム回答レコードを 1 つの CSV 文字列にまとめる。
 *
 * - 法人/個人で項目が異なるため、formType ごとに別々に呼び出して別ファイル化する想定。
 * - BOM 付き UTF-8 で Excel が文字化けしないようにする。
 * - 法人の「実質的支配者」は選択レコード全体で最大数まで列を確保する（不足分は空欄）。
 */
export function buildLoanSubmissionsCsv(
  formType: "loan-corporate" | "loan-individual",
  rows: LoanSubmissionCsvRow[],
): string {
  const isCorporate = formType === "loan-corporate";
  const baseSections: LoanFormSection[] = isCorporate
    ? CORPORATE_LOAN_SECTIONS
    : INDIVIDUAL_LOAN_SECTIONS;

  // 共通メタ列
  const metaHeaders = [
    "ID",
    "ベンダー",
    "フォーム種別",
    "回答日時",
    "会社名/屋号",
    "代表者/氏名",
    "メール",
    "電話番号",
    "ベンダー備考",
    "貸金業社備考",
    "弊社備考",
  ];

  // 法人の場合のみ、選択レコード全体の最大支配者数を算出
  let maxBoCount = 0;
  if (isCorporate) {
    for (const r of rows) {
      const current = r.modifiedAnswers ?? r.answers;
      const bo = getCorporateBOSections(current);
      if (bo.length > maxBoCount) maxBoCount = bo.length;
    }
  }

  // ヘッダー組み立て
  const headers: string[] = [...metaHeaders];
  const fieldKeys: string[] = [];
  for (const section of baseSections) {
    for (const field of section.fields) {
      headers.push(`${section.title} / ${field.label}`);
      fieldKeys.push(field.key);
    }
  }
  if (isCorporate && maxBoCount > 0) {
    // 1 サンプルから BO のフィールドラベル雛形を作る（誰でも 1 番目は同じ）
    const template = getCorporateBOSections({ corp_bo1_name: "x" });
    const boFieldLabels = template[0]?.fields ?? [];
    for (let i = 1; i <= maxBoCount; i++) {
      for (const field of boFieldLabels) {
        headers.push(`実質的支配者 ${i}人目 / ${field.label}`);
        // key は corp_boN_xxx → 元 key の bo1 を boN に置換して引く
        const replacedKey = field.key.replace(/^corp_bo1_/, `corp_bo${i}_`);
        fieldKeys.push(replacedKey);
      }
    }
  }

  // 行データ組み立て
  const data: string[][] = rows.map((r) => {
    const meta = [
      String(r.id),
      r.vendorName,
      isCorporate ? "法人" : "個人事業主",
      formatDateTime(r.submittedAt),
      r.companyName,
      r.representName,
      r.email,
      r.phone,
      r.vendorMemo ?? "",
      r.lenderMemo ?? "",
      r.staffMemo ?? "",
    ];
    const answers = fieldKeys.map((k) => pickAnswer(r.answers, r.modifiedAnswers, k));
    return [...meta, ...answers];
  });

  const csvBody = Papa.unparse([headers, ...data]);
  // Excel 用 BOM
  return `﻿${csvBody}`;
}

/**
 * Web ブラウザでファイルをダウンロードさせるユーティリティ。
 * クライアントコンポーネントから呼ぶ前提。
 */
export function downloadCsv(filename: string, csv: string): void {
  if (typeof window === "undefined") return;
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
