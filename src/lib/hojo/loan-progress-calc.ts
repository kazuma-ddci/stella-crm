/**
 * 貸金 顧客進捗の派生フィールド計算ロジック。
 * 1次利息分・1次償還額・2次返金系・運用フィーを、ソース項目と
 * グローバル設定（利息率・運用フィー率）から導出する。
 *
 * - ROUNDDOWN は Math.trunc（0方向への切り捨て、Excel ROUNDDOWN(x, 0) と同じ）
 * - 日数差は時刻無視の UTC 日換算で、開始日を含める
 * - 条件未充足の派生値は null を返す
 */

export type ProgressSource = {
  loanAmount: number | null;
  loanExecutionDate: Date | null;
  repaymentDate: Date | null;
  repaymentAmount: number | null;
  secondaryRepaymentDate: Date | null;
};

export type ProgressRates = {
  interestRate: number;
  feeRate: number;
};

export type DerivedFields = {
  interestAmount: number | null;
  operationFee: number | null;
  redemptionAmount: number | null;
  secondaryRepaymentAmount: number | null;
  secondaryPrincipalAmount: number | null;
  secondaryInterestAmount: number | null;
  secondaryRedemptionAmount: number | null;
};

export function diffDaysInclusiveUtc(end: Date, start: Date): number {
  const e = Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate());
  const s = Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate());
  return Math.floor((e - s) / 86400000) + 1;
}

const roundDown = (n: number) => Math.trunc(n);

/**
 * 貸金進捗の派生列を計算する。
 *
 * 仕様：
 * - 1次利息分 ← repaymentDate が空でない場合に ROUNDDOWN(rate * (days/365) * loanAmount)。
 *   （loanExecutionDate / loanAmount が無いと計算不能 → null）
 * - 1次償還額 ← repaymentAmount。
 * - 2次返金元金分 ← loanAmount - repaymentAmount。
 * - 2次利息分 ← 2次返金元金分 * rate * (1次返金日〜2次返金日の日数/365)。
 * - 2次返金額 ← 1次利息分 + 2次返金元金分 + 2次利息分。
 * - 運用フィー ← (1次利息分 + 2次利息分) * feeRate。
 * - 2次償還額 ← 2次返金元金分 + 運用フィー。
 */
export function computeDerivedFields(
  src: ProgressSource,
  rates: ProgressRates,
): DerivedFields {
  const { loanAmount, loanExecutionDate, repaymentDate, repaymentAmount, secondaryRepaymentDate } = src;

  let interestAmount: number | null = null;
  if (
    repaymentDate !== null &&
    loanExecutionDate !== null &&
    loanAmount !== null
  ) {
    const days = diffDaysInclusiveUtc(repaymentDate, loanExecutionDate);
    interestAmount = roundDown(rates.interestRate * (days / 365) * loanAmount);
  }

  const redemptionAmount = repaymentAmount;

  const secondaryPrincipalAmount =
    loanAmount !== null && repaymentAmount !== null
      ? loanAmount - repaymentAmount
      : null;

  let secondaryInterestAmount: number | null = null;
  if (
    secondaryPrincipalAmount !== null &&
    repaymentDate !== null &&
    secondaryRepaymentDate !== null
  ) {
    const days = diffDaysInclusiveUtc(secondaryRepaymentDate, repaymentDate);
    secondaryInterestAmount = roundDown(
      rates.interestRate * (days / 365) * secondaryPrincipalAmount,
    );
  }

  const secondaryRepaymentAmount =
    interestAmount !== null &&
    secondaryPrincipalAmount !== null &&
    secondaryInterestAmount !== null
      ? interestAmount + secondaryPrincipalAmount + secondaryInterestAmount
      : null;

  let operationFee: number | null = null;
  if (
    interestAmount !== null &&
    secondaryInterestAmount !== null
  ) {
    operationFee = roundDown((interestAmount + secondaryInterestAmount) * rates.feeRate);
  }

  const secondaryRedemptionAmount =
    secondaryPrincipalAmount !== null && operationFee !== null
      ? secondaryPrincipalAmount + operationFee
      : null;

  return {
    interestAmount,
    operationFee,
    redemptionAmount,
    secondaryRepaymentAmount,
    secondaryPrincipalAmount,
    secondaryInterestAmount,
    secondaryRedemptionAmount,
  };
}
