// 消費税区分（インボイスあり）
export const TAX_CLASSIFICATIONS_WITH_INVOICE = [
  { value: "taxable_10", label: "課税10%" },
  { value: "taxable_8", label: "課税8%（軽減）" },
  { value: "exempt", label: "非課税" },
  { value: "non_taxable", label: "不課税" },
  { value: "tax_free_export", label: "免税（輸出）" },
] as const;

// 消費税区分（インボイスなし）
export const TAX_CLASSIFICATIONS_WITHOUT_INVOICE = [
  { value: "taxable_10_no_invoice", label: "課税10%（インボイスなし）" },
  { value: "taxable_8_no_invoice", label: "課税8%（インボイスなし・軽減）" },
  { value: "exempt", label: "非課税" },
  { value: "non_taxable", label: "不課税" },
  { value: "tax_free_export", label: "免税（輸出）" },
] as const;

// 全消費税区分（バリデーション用）
export const TAX_CLASSIFICATIONS = [
  ...TAX_CLASSIFICATIONS_WITH_INVOICE,
  { value: "taxable_10_no_invoice", label: "課税10%（インボイスなし）" },
  { value: "taxable_8_no_invoice", label: "課税8%（インボイスなし・軽減）" },
] as const;

// 税率マッピング（税額自動計算用）
export const TAX_RATE_MAP: Record<string, number> = {
  taxable_10: 0.10,
  taxable_8: 0.08,
  taxable_10_no_invoice: 0.10,
  taxable_8_no_invoice: 0.08,
  exempt: 0,
  non_taxable: 0,
  tax_free_export: 0,
};

// 税額を自動計算（税抜金額 × 税率、端数切捨て）
export function calcTaxAmount(amount: number, taxClassification: string): number {
  const rate = TAX_RATE_MAP[taxClassification];
  if (!rate) return 0;
  return Math.floor(amount * rate);
}

export const REALIZATION_STATUSES = [
  { value: "realized", label: "実現" },
  { value: "unrealized", label: "未実現" },
] as const;
