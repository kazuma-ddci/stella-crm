// インボイス制度対応: 税率ごとに明細を集計し、端数処理は税率グループ単位で1回のみ（Math.floor）
type LineItem = {
  amount: number; // 税抜金額
  taxRate: number; // 税率(%)
};

type TaxRateSummary = Record<string, { subtotal: number; tax: number }>;

export function calcInvoiceTaxSummary(lineItems: LineItem[]): TaxRateSummary {
  const groups: Record<string, number> = {};

  for (const item of lineItems) {
    const key = String(item.taxRate);
    groups[key] = (groups[key] || 0) + item.amount;
  }

  const result: TaxRateSummary = {};
  for (const [rate, subtotal] of Object.entries(groups)) {
    const taxRate = Number(rate);
    result[rate] = {
      subtotal,
      tax: Math.floor((subtotal * taxRate) / 100), // 端数切捨て（税率グループ単位で1回のみ）
    };
  }

  return result;
}

// TaxRateSummaryから税込合計を計算
export function calcInvoiceTotalFromSummary(summary: TaxRateSummary): {
  totalAmount: number;
  taxAmount: number;
} {
  let totalAmount = 0;
  let taxAmount = 0;
  for (const group of Object.values(summary)) {
    totalAmount += group.subtotal + group.tax;
    taxAmount += group.tax;
  }
  return { totalAmount, taxAmount };
}
