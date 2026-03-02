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
 * 連番付き: {証憑種類ラベル}{NN}_{ユーザー入力名}_{YYYYMMDD_HHmmss}.{拡張子}
 *
 * 例: 請求書_テスト株式会社御中_20260227_191446.pdf
 * 連番例: 請求書02_テスト株式会社御中_20260227_191446.pdf
 */
export function generateAttachmentFileName(
  attachmentType: string,
  displayName: string,
  extension: string,
  date?: Date,
  suffixNumber?: number
): string {
  const typeLabel = ATTACHMENT_TYPE_LABELS[attachmentType] ?? "その他";
  const timestamp = formatTimestamp(date);
  const ext = extension.startsWith(".") ? extension : `.${extension}`;
  const suffix = suffixNumber && suffixNumber >= 2
    ? String(suffixNumber).padStart(2, "0")
    : "";
  return `${typeLabel}${suffix}_${displayName}_${timestamp}${ext}`;
}

/**
 * 既存ファイル名リストから重複を検出し、次の連番を返す
 * 同一の {証憑種類}_{表示名} を持つファイルがあれば連番を付与
 *
 * @returns undefined=重複なし, 2以上=付与すべき連番
 */
export function getNextDuplicateSuffix(
  attachmentType: string,
  displayName: string,
  existingNames: string[]
): number | undefined {
  const typeLabel = ATTACHMENT_TYPE_LABELS[attachmentType] ?? "その他";
  // 日時部分以降を除いた接頭辞で比較
  const basePrefix = `${typeLabel}_${displayName}_`;

  let maxSuffix = 0;

  for (const name of existingNames) {
    // 完全一致プレフィックス: 請求書_テスト_... → 連番なし（=1番目）
    if (name.startsWith(basePrefix)) {
      maxSuffix = Math.max(maxSuffix, 1);
      continue;
    }
    // 連番付きプレフィックス: 請求書02_テスト_... → 連番=02
    const escapedLabel = typeLabel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const escapedName = displayName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const suffixedRegex = new RegExp(
      `^${escapedLabel}(\\d{2,})_${escapedName}_`
    );
    const match = name.match(suffixedRegex);
    if (match) {
      maxSuffix = Math.max(maxSuffix, parseInt(match[1], 10));
    }
  }

  if (maxSuffix === 0) return undefined; // 重複なし
  return maxSuffix + 1;
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
