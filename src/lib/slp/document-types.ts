/**
 * SLP 公的提出書類の種別定義
 *
 * 「初回提出書類」(category=initial)
 *   - 源泉徴収簿 / 算定基礎届 / 賃金台帳
 *   - 各書類につき5期分（直近期 = period 0 〜 4期前 = period 4）
 *   - 全て任意提出
 *
 * 「追加提出書類」(category=additional)
 *   - 被保険者資格取得届 / 月額変更届 / 賞与支払届 / 標準報酬決定通知書
 *   - 各書類につき複数ファイル可（無制限）
 *   - 全て任意提出
 *
 * `documentType` の値は DB の slp_company_documents.document_type に保存されるため、
 * 一度確定したら名称を変えない（マイグレーションが必要になる）。
 */

export type SlpDocumentCategory = "initial" | "additional";

export type SlpInitialDocumentType =
  | "withholding_book" // 源泉徴収簿
  | "calculation_base" // 算定基礎届
  | "wage_ledger"; // 賃金台帳

export type SlpAdditionalDocumentType =
  | "qualification_acquisition" // 被保険者資格取得届
  | "monthly_change" // 月額変更届
  | "bonus_payment" // 賞与支払届
  | "standard_remuneration"; // 標準報酬決定通知書

export type SlpDocumentType = SlpInitialDocumentType | SlpAdditionalDocumentType;

export type SlpDocumentTypeDef = {
  type: SlpDocumentType;
  category: SlpDocumentCategory;
  label: string;
  description?: string;
};

/**
 * 5期分の期インデックス → 表示ラベル
 */
export const FISCAL_PERIODS = [
  { value: 0, label: "直近期" },
  { value: 1, label: "1期前" },
  { value: 2, label: "2期前" },
  { value: 3, label: "3期前" },
  { value: 4, label: "4期前" },
] as const;

export type FiscalPeriod = (typeof FISCAL_PERIODS)[number]["value"];

export const INITIAL_DOCUMENT_TYPES: readonly SlpDocumentTypeDef[] = [
  {
    type: "withholding_book",
    category: "initial",
    label: "源泉徴収簿",
    description: "5期分（直近期から4期前まで）。1期分は1ファイルにまとめてアップロードしてください。",
  },
  {
    type: "calculation_base",
    category: "initial",
    label: "算定基礎届",
    description: "5期分（直近期から4期前まで）。1期分は1ファイルにまとめてアップロードしてください。",
  },
  {
    type: "wage_ledger",
    category: "initial",
    label: "賃金台帳",
    description: "5期分（直近期から4期前まで）。1期分は1ファイルにまとめてアップロードしてください。",
  },
] as const;

export const ADDITIONAL_DOCUMENT_TYPES: readonly SlpDocumentTypeDef[] = [
  {
    type: "qualification_acquisition",
    category: "additional",
    label: "被保険者資格取得届",
    description: "ファイルは何件でもアップロードできます。",
  },
  {
    type: "monthly_change",
    category: "additional",
    label: "月額変更届",
    description: "ファイルは何件でもアップロードできます。",
  },
  {
    type: "bonus_payment",
    category: "additional",
    label: "賞与支払届",
    description: "ファイルは何件でもアップロードできます。",
  },
  {
    type: "standard_remuneration",
    category: "additional",
    label: "標準報酬決定通知書",
    description: "ファイルは何件でもアップロードできます。",
  },
] as const;

export const ALL_DOCUMENT_TYPES: readonly SlpDocumentTypeDef[] = [
  ...INITIAL_DOCUMENT_TYPES,
  ...ADDITIONAL_DOCUMENT_TYPES,
];

const TYPE_MAP: Record<string, SlpDocumentTypeDef> = Object.fromEntries(
  ALL_DOCUMENT_TYPES.map((t) => [t.type, t]),
);

export function getDocumentTypeDef(
  type: string,
): SlpDocumentTypeDef | undefined {
  return TYPE_MAP[type];
}

export function getDocumentTypeLabel(type: string): string {
  return TYPE_MAP[type]?.label ?? type;
}

export function getFiscalPeriodLabel(period: number | null | undefined): string {
  if (period == null) return "";
  const found = FISCAL_PERIODS.find((p) => p.value === period);
  return found?.label ?? `${period}期前`;
}

export function isInitialDocumentType(
  type: string,
): type is SlpInitialDocumentType {
  return INITIAL_DOCUMENT_TYPES.some((t) => t.type === type);
}

export function isAdditionalDocumentType(
  type: string,
): type is SlpAdditionalDocumentType {
  return ADDITIONAL_DOCUMENT_TYPES.some((t) => t.type === type);
}

/**
 * カテゴリと書類タイプの整合性チェック
 */
export function validateCategoryAndType(
  category: string,
  type: string,
): boolean {
  if (category === "initial") return isInitialDocumentType(type);
  if (category === "additional") return isAdditionalDocumentType(type);
  return false;
}

/**
 * 許可するアップロードファイル形式
 */
export const ALLOWED_DOCUMENT_MIME_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "image/jpeg",
  "image/png",
  "image/heic",
  "image/heif",
  "image/webp",
] as const;

/** 1ファイルあたり最大サイズ (20MB) */
export const MAX_DOCUMENT_FILE_SIZE = 20 * 1024 * 1024;
