export const EXCLUDED_REASONS = [
  "fee",
  "tax",
  "salary",
  "internal_transfer",
  "interest",
  "other",
] as const;
export type ExcludedReason = (typeof EXCLUDED_REASONS)[number];

export const EXCLUDED_REASON_LABELS: Record<ExcludedReason, string> = {
  fee: "振込手数料",
  tax: "税金",
  salary: "給与",
  internal_transfer: "自社内振替",
  interest: "利息",
  other: "その他",
};
