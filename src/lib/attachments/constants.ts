/**
 * 証憑種類の定数・ファイル名生成ユーティリティ
 */

// 証憑種類の選択肢（売上・経費 統一リスト）
export const ATTACHMENT_TYPE_OPTIONS = [
  { value: "invoice", label: "請求書" },
  { value: "estimate", label: "見積書" },
  { value: "delivery_note", label: "納品書" },
  { value: "order", label: "注文書" },
  { value: "order_confirmation", label: "注文請書" },
  { value: "purchase_order", label: "発注書" },
  { value: "contract", label: "契約書" },
  { value: "receipt", label: "領収書" },
  { value: "other", label: "その他" },
] as const;

// attachmentType → 日本語ラベル変換マップ
export const ATTACHMENT_TYPE_LABELS: Record<string, string> = {
  invoice: "請求書",
  estimate: "見積書",
  delivery_note: "納品書",
  order: "注文書",
  order_confirmation: "注文請書",
  purchase_order: "発注書",
  contract: "契約書",
  receipt: "領収書",
  invoice_old: "請求書(旧)",
  voucher: "証憑", // 既存データ互換
  other: "その他",
};

/**
 * タイムスタンプ文字列を生成（YYYYMMDD_HHmmss形式）
 */
export function formatTimestamp(date?: Date): string {
  const now = date ?? new Date();
  return [
    String(now.getFullYear()),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
    "_",
    String(now.getHours()).padStart(2, "0"),
    String(now.getMinutes()).padStart(2, "0"),
    String(now.getSeconds()).padStart(2, "0"),
  ].join("");
}

/**
 * 自動生成ファイル名を生成する
 * フォーマット: {証憑種類ラベル}_{ユーザー入力名}_{YYYYMMDD_HHmmss}.{拡張子}
 *
 * 例: 請求書_テスト株式会社御中_20260227_191446.pdf
 */
export function generateAttachmentFileName(
  attachmentType: string,
  displayName: string,
  extension: string,
  date?: Date
): string {
  const typeLabel = ATTACHMENT_TYPE_LABELS[attachmentType] ?? "その他";
  const timestamp = formatTimestamp(date);
  const ext = extension.startsWith(".") ? extension : `.${extension}`;
  return `${typeLabel}_${displayName}_${timestamp}${ext}`;
}

/**
 * ファイル名から拡張子を取得（ドット含む）
 */
export function getFileExtension(fileName: string): string {
  const lastDot = fileName.lastIndexOf(".");
  return lastDot >= 0 ? fileName.substring(lastDot) : "";
}

/**
 * ファイル名から拡張子を除いた部分を取得
 */
export function getFileNameWithoutExtension(fileName: string): string {
  const lastDot = fileName.lastIndexOf(".");
  return lastDot >= 0 ? fileName.substring(0, lastDot) : fileName;
}
