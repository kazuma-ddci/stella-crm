/**
 * Airwork CSV parser
 * Airワークからダウンロードした広告詳細/求人別配信実績CSVの解析
 */

import Papa from "papaparse";

// ============================================
// ファイル名解析
// ============================================

export type AirworkFileType = "daily" | "job_posting";

export type ParsedAirworkFilename = {
  type: AirworkFileType;
  adNumber: string;
  adName: string;
  exportDate: string; // YYYYMMDD
  exportTime: string; // HHMMSS
};

/**
 * Airwork CSVファイル名を解析
 *
 * 形式:
 *   広告詳細_{広告番号}_{広告名}_{YYYYMMDD}_{HHMMSS}.csv
 *   広告配信実績_求人_{広告番号}_{広告名}_{YYYYMMDD}_{HHMMSS}.csv
 *
 * 広告名にはアンダースコアが含まれることがある
 */
export function parseAirworkFilename(
  filename: string
): ParsedAirworkFilename | null {
  // 拡張子を除去
  let name = filename.replace(/\.csv$/i, "");

  // 末尾の " (N)" パターンを除去（ダウンロード時の重複回避）
  name = name.replace(/\s*\(\d+\)\s*$/, "");

  const parts = name.split("_");

  // 最低5パーツ必要（タイプ, 番号, 名前, 日付, 時刻）
  if (parts.length < 5) return null;

  // 末尾から時刻（6桁）と日付（8桁）を取得
  const timePart = parts[parts.length - 1];
  const datePart = parts[parts.length - 2];

  if (!/^\d{6}$/.test(timePart) || !/^\d{8}$/.test(datePart)) {
    return null;
  }

  // タイプ判定
  let type: AirworkFileType;
  let adNumberIndex: number;

  if (parts[0] === "広告詳細") {
    type = "daily";
    adNumberIndex = 1;
  } else if (parts[0] === "広告配信実績" && parts[1] === "求人") {
    type = "job_posting";
    adNumberIndex = 2;
  } else {
    return null;
  }

  const adNumber = parts[adNumberIndex];

  // adName = adNumber と日付の間のパーツをアンダースコアで結合
  const adNameParts = parts.slice(adNumberIndex + 1, parts.length - 2);
  const adName = adNameParts.join("_");

  if (!adNumber || !adName) return null;

  return {
    type,
    adNumber,
    adName,
    exportDate: datePart,
    exportTime: timePart,
  };
}

// ============================================
// 値クリーニング
// ============================================

/** カンマ付き数値文字列をパース（例: "16,937" → 16937） */
export function cleanNumber(raw: string): number {
  if (!raw || raw.trim() === "" || raw.trim() === "-") return 0;
  const normalized = raw
    .replace(/[０-９]/g, (ch) =>
      String.fromCharCode(ch.charCodeAt(0) - 0xfee0)
    )
    .replace(/，/g, ",")
    .replace(/,/g, "")
    .trim();
  const num = parseInt(normalized, 10);
  return isNaN(num) ? 0 : num;
}

/** パーセント文字列をパース（例: "5.04%" → 5.04） */
export function cleanRate(raw: string): number | null {
  if (!raw || raw.trim() === "" || raw.trim() === "-") return null;
  const normalized = raw.replace(/%/g, "").replace(/％/g, "").trim();
  const num = parseFloat(normalized);
  return isNaN(num) ? null : num;
}

/** 通貨文字列をパース（例: "¥161", "￥6,223" → 161, 6223） */
export function cleanCurrency(raw: string): number {
  if (!raw || raw.trim() === "" || raw.trim() === "-") return 0;
  const normalized = raw
    .replace(/[¥￥]/g, "")
    .replace(/[０-９]/g, (ch) =>
      String.fromCharCode(ch.charCodeAt(0) - 0xfee0)
    )
    .replace(/，/g, ",")
    .replace(/,/g, "")
    .trim();
  const num = parseInt(normalized, 10);
  return isNaN(num) ? 0 : num;
}

// ============================================
// CSV行データ型
// ============================================

export type ParsedDailyRow = {
  date: string; // YYYY-MM-DD
  impressions: number;
  clicks: number;
  applicationStarts: number;
  applications: number;
  cost: number;
  ctr: number | null;
  applicationStartRate: number | null;
  applicationCompletionRate: number | null;
  applicationRate: number | null;
  cpc: number | null;
  costPerApplicationStart: number | null;
  cpa: number | null;
};

export type ParsedJobPostingRow = {
  jobNumber: string;
  jobTitle: string;
  jobMemo: string | null;
  impressions: number;
  clicks: number;
  applicationStarts: number;
  applications: number;
  cost: number;
  ctr: number | null;
  applicationStartRate: number | null;
  applicationCompletionRate: number | null;
  applicationRate: number | null;
  cpc: number | null;
  costPerApplicationStart: number | null;
  cpa: number | null;
  employmentType: string | null;
};

// ============================================
// CSV解析
// ============================================

/**
 * 日付文字列 "YYYY/MM/DD" → "YYYY-MM-DD" に変換
 */
function parseDate(raw: string): string | null {
  const match = raw.trim().match(/(\d{4})[/\-.](\d{1,2})[/\-.](\d{1,2})/);
  if (!match) return null;
  const [, year, month, day] = match;
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

/**
 * 広告詳細CSVテキストを解析
 * 列: 配信日, 表示数, クリック率, クリック数, 応募開始率, 応募開始数, 応募完了率, 応募数, 応募率, クリック単価, 応募開始単価, 応募単価, 利用済予算
 */
export function parseDailyCsv(csvText: string): ParsedDailyRow[] {
  const result = Papa.parse<string[]>(csvText, {
    header: false,
    skipEmptyLines: true,
  });

  const rows: ParsedDailyRow[] = [];

  for (let i = 1; i < result.data.length; i++) {
    const row = result.data[i];
    if (!row || row.length < 13) continue;

    // 「合計」行をスキップ
    const firstCell = (row[0] ?? "").trim();
    if (firstCell === "合計" || firstCell === "") continue;

    const date = parseDate(firstCell);
    if (!date) continue;

    rows.push({
      date,
      impressions: cleanNumber(row[1]),
      ctr: cleanRate(row[2]),
      clicks: cleanNumber(row[3]),
      applicationStartRate: cleanRate(row[4]),
      applicationStarts: cleanNumber(row[5]),
      applicationCompletionRate: cleanRate(row[6]),
      applications: cleanNumber(row[7]),
      applicationRate: cleanRate(row[8]),
      cpc: cleanCurrency(row[9]),
      costPerApplicationStart: cleanCurrency(row[10]),
      cpa: cleanCurrency(row[11]),
      cost: cleanCurrency(row[12]),
    });
  }

  return rows;
}

/**
 * 求人別配信実績CSVテキストを解析
 * 列: 求人番号, 求人内容, 求人メモ, 表示数, クリック率, クリック数, 応募開始率, 応募開始数, 応募完了率, 応募数, 応募率, クリック単価, 応募開始単価, 応募単価, 利用済予算, 雇用形態
 */
export function parseJobPostingCsv(csvText: string): ParsedJobPostingRow[] {
  const result = Papa.parse<string[]>(csvText, {
    header: false,
    skipEmptyLines: true,
  });

  const rows: ParsedJobPostingRow[] = [];

  for (let i = 1; i < result.data.length; i++) {
    const row = result.data[i];
    if (!row || row.length < 15) continue;

    // 「合計」行をスキップ（求人番号が空 or "合計"）
    const jobNumber = (row[0] ?? "").trim();
    if (jobNumber === "合計" || jobNumber === "") continue;

    rows.push({
      jobNumber,
      jobTitle: (row[1] ?? "").trim(),
      jobMemo: (row[2] ?? "").trim() || null,
      impressions: cleanNumber(row[3]),
      ctr: cleanRate(row[4]),
      clicks: cleanNumber(row[5]),
      applicationStartRate: cleanRate(row[6]),
      applicationStarts: cleanNumber(row[7]),
      applicationCompletionRate: cleanRate(row[8]),
      applications: cleanNumber(row[9]),
      applicationRate: cleanRate(row[10]),
      cpc: cleanCurrency(row[11]),
      costPerApplicationStart: cleanCurrency(row[12]),
      cpa: cleanCurrency(row[13]),
      cost: cleanCurrency(row[14]),
      employmentType: (row[15] ?? "").trim() || null,
    });
  }

  return rows;
}
