// ダウンロード時に使う日本語ファイル名を動的生成するユーティリティ。
// DB の fileName 列（物理ファイル名）は触らず、表示名のみを変換する。

export const DOC_TYPE_JP: Record<string, string> = {
  training_report: "研修終了報告書",
  support_application: "支援制度申請書",
  business_plan: "事業計画書",
};

function formatYmd(dateLike: string | Date): string {
  const d = typeof dateLike === "string" ? new Date(dateLike) : dateLike;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}

/** Windows/macOS 等で禁止される文字を `_` に置換する */
function sanitizeForFilename(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, "_").trim();
}

/**
 * 個別PDFのダウンロード時ファイル名。
 * 例: `研修終了報告書_田中太郎_20260421.pdf`
 */
export function buildDisplayFileName(
  docType: string,
  applicantName: string | null | undefined,
  generatedAt: string | Date,
): string {
  const label = DOC_TYPE_JP[docType] ?? docType;
  const date = formatYmd(generatedAt);
  const name = sanitizeForFilename(applicantName || "申請者");
  return `${label}_${name}_${date}.pdf`;
}

/**
 * 一括ダウンロード ZIP のファイル名。
 * 例: `資料一式_田中太郎_20260421.zip`
 */
export function buildZipFileName(
  applicantName: string | null | undefined,
  date: Date = new Date(),
): string {
  const name = sanitizeForFilename(applicantName || "申請者");
  return `資料一式_${name}_${formatYmd(date)}.zip`;
}

/**
 * RFC 5987 形式で Content-Disposition ヘッダ用の attachment 指定を生成。
 * 日本語ファイル名を含む場合に使う。
 */
export function contentDispositionForDownload(filename: string): string {
  const encoded = encodeURIComponent(filename).replace(/['()]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
  // fallback ASCII 部分は安全な簡易名
  const ascii = filename.replace(/[^\x20-\x7e]/g, "_");
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encoded}`;
}
