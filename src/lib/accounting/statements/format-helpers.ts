/**
 * 銀行明細CSVパーサ群で共有する小さなヘルパ関数。
 */

/**
 * 数値文字列を整数（円）に正規化する。
 * - カンマ・全角空白・引用符・通貨記号などを除去
 * - 全角数字を半角に変換
 * - 空文字や "-" は null
 */
export function parseAmountToInt(raw: string | undefined | null): number | null {
  if (raw === undefined || raw === null) return null;
  const trimmed = raw.trim();
  if (trimmed === "" || trimmed === "-") return null;

  const normalized = trimmed
    .replace(/[０-９]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0))
    .replace(/[，]/g, ",")
    .replace(/[−ー]/g, "-")
    .replace(/[¥￥,\s"']/g, "")
    .trim();

  if (normalized === "" || normalized === "-") return null;
  const num = Number(normalized);
  if (!Number.isFinite(num)) return null;
  return Math.trunc(num);
}

/**
 * "YYYY/MM/DD" or "YYYY-MM-DD" or "YYYY.MM.DD" を ISO 化。
 */
export function parseDateSlash(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const m = raw
    .trim()
    .replace(/[０-９]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0))
    .match(/(\d{4})[/\-.](\d{1,2})[/\-.](\d{1,2})/);
  if (!m) return null;
  const [, y, mo, d] = m;
  return formatIso(parseInt(y, 10), parseInt(mo, 10), parseInt(d, 10));
}

/**
 * "YYYYMMDD" 8桁を ISO 化。
 */
export function parseDate8(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const cleaned = raw
    .trim()
    .replace(/[０-９]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0));
  const m = cleaned.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (!m) return null;
  const [, y, mo, d] = m;
  return formatIso(parseInt(y, 10), parseInt(mo, 10), parseInt(d, 10));
}

/**
 * "YYMMDD" 6桁を ISO 化（全銀フォーマット）。
 * 慣例: 00-30 → 2000-2030, 31-99 → 1931-1999。
 */
export function parseDate6(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const cleaned = raw
    .trim()
    .replace(/[０-９]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0));
  const m = cleaned.match(/^(\d{2})(\d{2})(\d{2})$/);
  if (!m) return null;
  const yy = parseInt(m[1], 10);
  const fullYear = yy <= 30 ? 2000 + yy : 1900 + yy;
  return formatIso(fullYear, parseInt(m[2], 10), parseInt(m[3], 10));
}

function formatIso(y: number, mo: number, d: number): string | null {
  if (y < 1900 || y > 2100 || mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/**
 * メモセル正規化: "-" や空白のみを null 化。
 */
export function normalizeMemo(raw: string | undefined | null): string | null {
  if (raw === undefined || raw === null) return null;
  const trimmed = raw.trim();
  if (trimmed === "" || trimmed === "-" || trimmed === "ー") return null;
  return trimmed;
}

/**
 * BOM 除去 + 改行統一。
 */
export function normalizeText(text: string): string {
  let t = text;
  if (t.charCodeAt(0) === 0xfeff) t = t.slice(1);
  return t.replace(/\r\n?/g, "\n");
}
