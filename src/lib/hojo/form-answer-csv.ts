import Papa from "papaparse";
import { ANSWER_GROUPS, FILE_FIELDS, getCurrentAnswer } from "./form-answer-sections";

type FileInfo = { filePath?: string; fileName?: string };

export type FormSubmissionCsvRow = {
  id: number;
  submittedAt: Date;
  confirmedAt: Date | null;
  formTranscriptDate: Date | null;
  applicantName: string | null;
  uid: string | null;
  answers: Record<string, unknown>;
  modifiedAnswers: Record<string, unknown> | null;
  fileUrls: Record<string, FileInfo> | null;
};

function formatDate(d: Date | null): string {
  if (!d) return "";
  return d.toISOString().slice(0, 10);
}

function formatDateTime(d: Date | null): string {
  if (!d) return "";
  return d.toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" });
}

export function buildFormSubmissionsCsv(rows: FormSubmissionCsvRow[]): string {
  const headers: string[] = [
    "ID",
    "回答日時",
    "確定日時",
    "フォーム転記日",
    "申請者名（支援金管理）",
    "UID",
  ];

  const fieldPaths: Array<[string, string]> = [];
  for (const group of ANSWER_GROUPS) {
    for (const field of group.fields) {
      headers.push(`${group.title} / ${field.label}`);
      fieldPaths.push([group.path, field.key]);
    }
  }

  for (const fileField of FILE_FIELDS) {
    headers.push(`${fileField.label}（ファイル名）`);
    headers.push(`${fileField.label}（URL）`);
  }

  const records: string[][] = rows.map((row) => {
    const values: string[] = [
      String(row.id),
      formatDateTime(row.submittedAt),
      formatDateTime(row.confirmedAt),
      formatDate(row.formTranscriptDate),
      row.applicantName ?? "",
      row.uid ?? "",
    ];

    for (const [path, key] of fieldPaths) {
      values.push(getCurrentAnswer(row.answers, row.modifiedAnswers, path, key));
    }

    for (const fileField of FILE_FIELDS) {
      const info = row.fileUrls?.[fileField.key];
      values.push(info?.fileName ?? "");
      values.push(info?.filePath ?? "");
    }

    return values;
  });

  const csv = Papa.unparse({ fields: headers, data: records }, { quotes: true });
  // BOM付きUTF-8（Excelで文字化け回避）
  return "\ufeff" + csv;
}
