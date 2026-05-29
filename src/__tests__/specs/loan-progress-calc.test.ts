import { describe, expect, it } from "vitest";
import { computeDerivedFields, diffDaysInclusiveUtc } from "@/lib/hojo/loan-progress-calc";

const utcDate = (date: string) => new Date(`${date}T00:00:00.000Z`);

describe("補助金 貸金顧客進捗の返金計算", () => {
  it("貸付実行日から1次返金日までの日数は開始日を含めて数える", () => {
    expect(diffDaysInclusiveUtc(utcDate("2026-05-15"), utcDate("2026-05-12"))).toBe(4);
  });

  it("利息15%・運用フィー50%で1次/2次返金の派生項目を計算する", () => {
    const derived = computeDerivedFields(
      {
        loanAmount: 1_000_000,
        loanExecutionDate: utcDate("2026-05-12"),
        repaymentDate: utcDate("2026-05-15"),
        repaymentAmount: 400_000,
        secondaryRepaymentDate: utcDate("2026-06-14"),
      },
      { interestRate: 0.15, feeRate: 0.5 },
    );

    expect(derived).toEqual({
      interestAmount: 1643,
      redemptionAmount: 400_000,
      secondaryPrincipalAmount: 600_000,
      secondaryInterestAmount: 7643,
      secondaryRepaymentAmount: 609_286,
      operationFee: 4643,
      secondaryRedemptionAmount: 604_643,
    });
  });

  it("運用フィー率を変更すると利息合計への割合として反映する", () => {
    const derived = computeDerivedFields(
      {
        loanAmount: 1_000_000,
        loanExecutionDate: utcDate("2026-05-12"),
        repaymentDate: utcDate("2026-05-15"),
        repaymentAmount: 400_000,
        secondaryRepaymentDate: utcDate("2026-06-14"),
      },
      { interestRate: 0.15, feeRate: 0.4 },
    );

    expect(derived.operationFee).toBe(3714);
    expect(derived.secondaryRedemptionAmount).toBe(603_714);
  });

  it("必須日付や金額が未入力の場合は計算不能な派生項目を空にする", () => {
    const derived = computeDerivedFields(
      {
        loanAmount: 1_000_000,
        loanExecutionDate: utcDate("2026-05-12"),
        repaymentDate: null,
        repaymentAmount: 400_000,
        secondaryRepaymentDate: null,
      },
      { interestRate: 0.15, feeRate: 0.5 },
    );

    expect(derived).toEqual({
      interestAmount: null,
      redemptionAmount: 400_000,
      secondaryPrincipalAmount: 600_000,
      secondaryInterestAmount: null,
      secondaryRepaymentAmount: null,
      operationFee: null,
      secondaryRedemptionAmount: null,
    });
  });
});
