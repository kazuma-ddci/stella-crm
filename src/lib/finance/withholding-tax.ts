// 源泉徴収税額を計算（日本の税法準拠）
// 100万円以下: 10.21%
// 100万円超: 超過分に20.42% + 100万円分の10.21%
export function calcWithholdingTax(amount: number): number {
  if (amount <= 0) return 0;
  if (amount <= 1_000_000) {
    return Math.floor((amount * 10.21) / 100);
  }
  const base = Math.floor((1_000_000 * 10.21) / 100); // 102,100
  const excess = Math.floor(((amount - 1_000_000) * 20.42) / 100);
  return base + excess;
}

export function isWithholdingTarget(agent: {
  isIndividualBusiness: boolean;
}): boolean {
  return agent.isIndividualBusiness;
}
