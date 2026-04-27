/**
 * 貸金 顧客進捗の派生フィールド計算ロジック。
 * 元金分・利息分・過不足・運用フィー・償還額 を、ソース項目（返金額・返金日）と
 * グローバル設定（利息率・フィー率）から導出する。
 *
 * - ROUNDDOWN は Math.trunc（0方向への切り捨て、Excel ROUNDDOWN(x, 0) と同じ）
 * - 日数差は時刻無視の UTC 日換算
 * - 条件未充足の派生値は null を返す
 */

export type ProgressSource = {
  loanAmount: number | null;
  loanExecutionDate: Date | null;
  repaymentDate: Date | null;
  repaymentAmount: number | null;
};

export type ProgressRates = {
  interestRate: number;
  feeRate: number;
};

export type DerivedFields = {
  principalAmount: number | null;
  interestAmount: number | null;
  overshortAmount: number | null;
  operationFee: number | null;
  redemptionAmount: number | null;
};

function diffDaysUtc(end: Date, start: Date): number {
  const e = Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate());
  const s = Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate());
  return Math.floor((e - s) / 86400000);
}

const roundDown = (n: number) => Math.trunc(n);

/**
 * 派生 5 列を計算する。
 *
 * 仕様：
 * - 元金分 ← repaymentAmount が空でない場合に loanAmount。
 * - 利息分 ← repaymentDate が空でない場合に ROUNDDOWN(rate * (days/365) * loanAmount)。
 *   （loanExecutionDate / loanAmount が無いと計算不能 → null）
 * - 過不足 ← repaymentAmount が空でない場合に repaymentAmount − principalAmount − interestAmount。
 *   （未確定の派生値は 0 として扱う）
 * - 運用フィー ← principalAmount が空でない場合に ROUNDDOWN(feeRate * (days/365) * loanAmount)。
 *   （loanExecutionDate / repaymentDate / loanAmount が無いと計算不能 → null）
 * - 償還額 ← principalAmount が空でない場合に principalAmount + (operationFee ?? 0)。
 */
export function computeDerivedFields(
  src: ProgressSource,
  rates: ProgressRates,
): DerivedFields {
  const { loanAmount, loanExecutionDate, repaymentDate, repaymentAmount } = src;

  const principalAmount =
    repaymentAmount !== null && loanAmount !== null ? loanAmount : null;

  let interestAmount: number | null = null;
  if (
    repaymentDate !== null &&
    loanExecutionDate !== null &&
    loanAmount !== null
  ) {
    const days = diffDaysUtc(repaymentDate, loanExecutionDate);
    interestAmount = roundDown(rates.interestRate * (days / 365) * loanAmount);
  }

  let operationFee: number | null = null;
  if (
    principalAmount !== null &&
    repaymentDate !== null &&
    loanExecutionDate !== null &&
    loanAmount !== null
  ) {
    const days = diffDaysUtc(repaymentDate, loanExecutionDate);
    operationFee = roundDown(rates.feeRate * (days / 365) * loanAmount);
  }

  const redemptionAmount =
    principalAmount !== null
      ? principalAmount + (operationFee ?? 0)
      : null;

  const overshortAmount =
    repaymentAmount !== null
      ? repaymentAmount - (principalAmount ?? 0) - (interestAmount ?? 0)
      : null;

  return {
    principalAmount,
    interestAmount,
    overshortAmount,
    operationFee,
    redemptionAmount,
  };
}
