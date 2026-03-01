// インボイス制度対応: 税率ごとに明細を集計し、端数処理は税率グループ単位で1回のみ（Math.floor）
// knownTax: DB保存済みの税額がある場合はそれを合算し、再計算による¥1ズレを防ぐ
type LineItem = {
  amount: number; // 税抜金額
  taxRate: number; // 税率(%)
  knownTax?: number; // DB保存済みの税額（あればそのまま使う）
};

type TaxRateSummary = Record<string, { subtotal: number; tax: number }>;

export function calcInvoiceTaxSummary(lineItems: LineItem[]): TaxRateSummary {
  const groups: Record<string, { subtotal: number; knownTaxSum: number; hasUnknown: boolean }> = {};

  for (const item of lineItems) {
    const key = String(item.taxRate);
    if (!groups[key]) groups[key] = { subtotal: 0, knownTaxSum: 0, hasUnknown: false };
    groups[key].subtotal += item.amount;
    if (item.knownTax != null) {
      groups[key].knownTaxSum += item.knownTax;
    } else {
      groups[key].hasUnknown = true;
    }
  }

  const result: TaxRateSummary = {};
  for (const [rate, g] of Object.entries(groups)) {
    const taxRate = Number(rate);
    result[rate] = {
      subtotal: g.subtotal,
      // knownTaxが全て揃っていればそれを使う。揃っていなければ従来のグループ計算
      tax: !g.hasUnknown
        ? g.knownTaxSum
        : Math.floor((g.subtotal * taxRate) / 100),
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
