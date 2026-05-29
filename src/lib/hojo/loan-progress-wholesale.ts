import { randomBytes } from "crypto";
import type { Prisma } from "@prisma/client";

type PrismaLike = Prisma.TransactionClient;

type WholesaleSeed = {
  id: number;
  vendorId: number;
  companyName: string | null;
  applicantType: string | null;
  subsidyTargetAmountTaxIncluded: number | null;
  loanUsage: string | null;
};

export const FORM_UPDATE_STATUS = {
  UNSENT: "未送信",
  SUBMITTED: "送信済み",
  PENDING: "修正申請中",
  APPLIED: "変更反映済み",
  REJECTED: "変更却下済み",
} as const;

export function normalizeApplicantType(value: unknown) {
  const text = value ? String(value).trim() : "";
  return text === "法人" || text === "個人事業主" ? text : null;
}

export function formTypeFromApplicantType(applicantType: string | null | undefined) {
  return applicantType === "法人"
    ? "loan-corporate"
    : applicantType === "個人事業主"
      ? "loan-individual"
      : null;
}

export function generateLoanFormToken() {
  return randomBytes(24).toString("hex");
}

function amountFromWholesale(account: WholesaleSeed) {
  return account.subsidyTargetAmountTaxIncluded ?? null;
}

export async function ensureLoanProgressForWholesaleAccount(
  client: PrismaLike,
  account: WholesaleSeed,
) {
  const existing = await client.hojoLoanProgress.findUnique({
    where: { wholesaleAccountId: account.id },
  });

  const data = {
    vendorId: account.vendorId,
    companyName: account.companyName,
    applicantType: normalizeApplicantType(account.applicantType),
    loanAmount: amountFromWholesale(account),
    toolPurchasePrice: amountFromWholesale(account),
  };

  if (existing) {
    return client.hojoLoanProgress.update({
      where: { id: existing.id },
      data: {
        ...data,
        formToken: existing.formToken ?? generateLoanFormToken(),
      },
    });
  }

  return client.hojoLoanProgress.create({
    data: {
      ...data,
      wholesaleAccountId: account.id,
      formToken: generateLoanFormToken(),
      formUpdateStatus: FORM_UPDATE_STATUS.UNSENT,
      loanUsageApproved: "有",
    },
  });
}

export async function syncLoanProgressAfterWholesaleSave(
  client: PrismaLike,
  account: WholesaleSeed,
  previousLoanUsage?: string | null,
) {
  const progress = await client.hojoLoanProgress.findUnique({
    where: { wholesaleAccountId: account.id },
  });

  if (account.loanUsage === "有") {
    const ensured = await ensureLoanProgressForWholesaleAccount(client, account);
    if (ensured.loanUsageApproved === "有") {
      await client.hojoLoanProgress.update({
        where: { id: ensured.id },
        data: {
          loanUsagePending: null,
          loanUsageChangeRequestedAt: null,
        },
      });
    } else if (previousLoanUsage !== undefined && previousLoanUsage !== "有") {
      await client.hojoLoanProgress.update({
        where: { id: ensured.id },
        data: {
          loanUsagePending: "有",
          loanUsageChangeRequestedAt: new Date(),
        },
      });
    }
    return;
  }

  if (progress) {
    const pendingUsage =
      account.loanUsage === progress.loanUsageApproved
        ? null
        : previousLoanUsage !== undefined && previousLoanUsage !== account.loanUsage && progress.loanUsageApproved === "有"
          ? "無"
          : progress.loanUsagePending;
    await client.hojoLoanProgress.update({
      where: { id: progress.id },
      data: {
        companyName: account.companyName,
        applicantType: normalizeApplicantType(account.applicantType),
        loanAmount: amountFromWholesale(account),
        toolPurchasePrice: amountFromWholesale(account),
        loanUsagePending: pendingUsage,
        loanUsageChangeRequestedAt:
          pendingUsage && pendingUsage !== progress.loanUsagePending
            ? new Date()
            : pendingUsage
              ? progress.loanUsageChangeRequestedAt
              : null,
      },
    });
  }
}

export function mergeFixedLoanAnswers(
  formType: string,
  answers: Record<string, unknown>,
  account: WholesaleSeed,
) {
  const fixedAmount = account.subsidyTargetAmountTaxIncluded == null
    ? ""
    : String(account.subsidyTargetAmountTaxIncluded);
  const fixedName = account.companyName ?? "";

  if (formType === "loan-corporate") {
    return {
      ...answers,
      corp_company_name: fixedName,
      corp_loan_amount: fixedAmount,
    };
  }

  return {
    ...answers,
    ind_business_name: fixedName,
    ind_loan_amount: fixedAmount,
  };
}
