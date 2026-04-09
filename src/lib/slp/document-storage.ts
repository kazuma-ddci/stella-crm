import path from "path";
import { mkdir, writeFile, unlink, stat } from "fs/promises";
import crypto from "crypto";

/**
 * SLP 企業提出書類のファイル保存先ヘルパー
 *
 * 物理ファイルは `public/uploads/slp/company-documents/{companyRecordId}/{yyyy-mm}/{uuid}-{filename}`
 * に保存し、DB の filePath には `/uploads/slp/company-documents/...` 形式の公開パスを保存する。
 * `/uploads/*` は middleware で `/api/uploads/*` にリライトされるため、認証チェックを通る形で配信される。
 */

const PUBLIC_BASE = "/uploads/slp/company-documents";

/**
 * ファイル名を OS で安全な形にサニタイズする。
 * - パス区切り文字や制御文字を _ に置換
 * - 連続スペースを 1 つに
 * - 末尾の . を削除
 * - 200 文字に切り詰める（拡張子は保持）
 */
export function sanitizeFileName(originalName: string): string {
  // 拡張子を分離
  const ext = path.extname(originalName);
  const base = path.basename(originalName, ext);
  // 制御文字・パス文字を除去
  const safeBase = base
    .replace(/[\x00-\x1f\x7f]/g, "")
    .replace(/[\\/:*?"<>|]/g, "_")
    .replace(/\s+/g, " ")
    .trim();
  const safeExt = ext.replace(/[\\/:*?"<>|]/g, "");
  // 拡張子分を残して 200 文字以内に
  const maxBaseLen = Math.max(1, 200 - safeExt.length);
  const truncatedBase = safeBase.slice(0, maxBaseLen) || "file";
  return `${truncatedBase}${safeExt}`;
}

/**
 * 書類ファイルを保存し、DB に保存する filePath（公開パス）と物理パスを返す。
 *
 * @param companyRecordId  紐づけ先の SlpCompanyRecord.id
 * @param originalFileName 元のファイル名（表示用に DB へも保存）
 * @param buffer           ファイルの中身
 */
export async function saveCompanyDocumentFile(
  companyRecordId: number,
  originalFileName: string,
  buffer: Buffer,
): Promise<{
  publicPath: string;
  absolutePath: string;
  storedFileName: string;
}> {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dirYearMonth = `${yyyy}-${mm}`;

  const safeName = sanitizeFileName(originalFileName);
  const uuid = crypto.randomUUID();
  const storedFileName = `${uuid}-${safeName}`;

  const absoluteDir = path.join(
    process.cwd(),
    "public",
    "uploads",
    "slp",
    "company-documents",
    String(companyRecordId),
    dirYearMonth,
  );
  await mkdir(absoluteDir, { recursive: true });

  const absolutePath = path.join(absoluteDir, storedFileName);
  await writeFile(absolutePath, buffer);

  const publicPath = `${PUBLIC_BASE}/${companyRecordId}/${dirYearMonth}/${storedFileName}`;
  return { publicPath, absolutePath, storedFileName };
}

/**
 * filePath（DB に保存された公開パス）から実ファイルの絶対パスを得る。
 * 安全のため、`public/uploads/slp/company-documents/` 配下のみ許可する。
 */
export function resolveCompanyDocumentAbsolutePath(
  filePath: string,
): string | null {
  if (!filePath.startsWith(PUBLIC_BASE + "/")) return null;
  // パストラバーサル防止
  if (filePath.includes("..")) return null;
  const relative = filePath.replace(/^\//, "");
  const absolute = path.join(process.cwd(), "public", relative);
  // 二重チェック: 解決後も base ディレクトリ内であること
  const baseAbs = path.join(
    process.cwd(),
    "public",
    "uploads",
    "slp",
    "company-documents",
  );
  if (!absolute.startsWith(baseAbs + path.sep)) return null;
  return absolute;
}

/**
 * 物理ファイルを削除する（論理削除時の orphan 掃除用 / 将来用）。
 * エラーは無視する（ファイルが既に無くてもログだけ出す）。
 */
export async function tryUnlinkCompanyDocumentFile(
  filePath: string,
): Promise<void> {
  const abs = resolveCompanyDocumentAbsolutePath(filePath);
  if (!abs) return;
  try {
    await stat(abs);
    await unlink(abs);
  } catch {
    /* noop */
  }
}
