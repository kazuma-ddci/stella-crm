import { describe, expect, it, vi } from "vitest";
import {
  ensureLoanProgressForWholesaleAccount,
  syncLoanProgressAfterWholesaleSave,
} from "@/lib/hojo/loan-progress-wholesale";

const wholesaleAccount = {
  id: 10,
  vendorId: 20,
  companyName: "株式会社テスト",
  applicantType: "法人",
  subsidyTargetAmountTaxIncluded: 1_234_567,
  loanUsage: "有",
};

describe("補助金 貸金進捗とセキュリティクラウド卸顧客リストの同期", () => {
  it("新規の貸金進捗作成時、補助金対象額（税込）を貸付金額とツール購入代金へ反映する", async () => {
    const create = vi.fn().mockResolvedValue({ id: 1 });
    const client = {
      hojoLoanProgress: {
        findUnique: vi.fn().mockResolvedValue(null),
        create,
      },
    };

    await ensureLoanProgressForWholesaleAccount(client as never, wholesaleAccount);

    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        loanAmount: 1_234_567,
        toolPurchasePrice: 1_234_567,
      }),
    });
  });

  it("既存の貸金進捗同期時も、補助金対象額（税込）でツール購入代金を更新する", async () => {
    const update = vi.fn().mockResolvedValue({ id: 1, loanUsageApproved: "有" });
    const client = {
      hojoLoanProgress: {
        findUnique: vi.fn().mockResolvedValue({ id: 1, formToken: "token" }),
        update,
      },
    };

    await ensureLoanProgressForWholesaleAccount(client as never, wholesaleAccount);

    expect(update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: expect.objectContaining({
        loanAmount: 1_234_567,
        toolPurchasePrice: 1_234_567,
      }),
    });
  });

  it("貸金利用が無の既存進捗でも、金額変更はツール購入代金へ反映する", async () => {
    const update = vi.fn().mockResolvedValue({ id: 1 });
    const client = {
      hojoLoanProgress: {
        findUnique: vi.fn().mockResolvedValue({
          id: 1,
          loanUsageApproved: "有",
          loanUsagePending: null,
          loanUsageChangeRequestedAt: null,
        }),
        update,
      },
    };

    await syncLoanProgressAfterWholesaleSave(client as never, {
      ...wholesaleAccount,
      loanUsage: "無",
    });

    expect(update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: expect.objectContaining({
        loanAmount: 1_234_567,
        toolPurchasePrice: 1_234_567,
      }),
    });
  });
});
