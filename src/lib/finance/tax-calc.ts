/**
 * 税額を計算する（文字列入出力版）
 *
 * @param amt - 金額（文字列）
 * @param rate - 税率（文字列、例: "10"）
 * @param type - 税区分（"tax_excluded" | "tax_included"）
 * @returns 税額（文字列）
 */
export function calcTax(amt: string, rate: string, type: string): string {
  const a = Number(amt);
  const r = Number(rate);
  if (!a || !r) return "0";
  if (type === "tax_excluded") {
    return String(Math.floor((a * r) / 100));
  }
  return String(Math.floor((a * r) / (100 + r)));
}
