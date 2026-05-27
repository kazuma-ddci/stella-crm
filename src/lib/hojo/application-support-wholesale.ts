import { randomBytes } from "crypto";
import type { Prisma } from "@prisma/client";

type PrismaLike = Prisma.TransactionClient;

type WholesaleSeed = {
  id: number;
  vendorId: number;
  companyName: string | null;
  grantUsage: string | null;
  subsidyTargetAmountTaxIncluded?: number | null;
  applicationAmount?: number | null;
};

export const APPLICATION_FORM_UPDATE_STATUS = {
  UNSENT: "未送信",
  SUBMITTED: "送信済み",
  PENDING: "修正申請中",
  APPLIED: "変更反映済み",
  REJECTED: "変更却下済み",
} as const;

export function generateApplicationFormToken() {
  return randomBytes(24).toString("hex");
}

function subsidyAmountFromWholesale(account: WholesaleSeed) {
  return account.applicationAmount ?? account.subsidyTargetAmountTaxIncluded ?? null;
}

export function calculateGrantPaymentAmounts(subsidyAmount: number | null | undefined) {
  if (subsidyAmount == null) {
    return {
      paymentReceivedAmount: null,
      bbsTransferAmount: null,
    };
  }

  const paymentReceivedAmount = Math.round(subsidyAmount * 1.1 + 55_000 + 165_000);
  return {
    paymentReceivedAmount,
    bbsTransferAmount: paymentReceivedAmount - 55_000,
  };
}

export async function ensureApplicationSupportForWholesaleAccount(
  client: PrismaLike,
  account: WholesaleSeed,
) {
  const existing = await client.hojoApplicationSupport.findUnique({
    where: { wholesaleAccountId: account.id },
  });

  const data = {
    vendorId: account.vendorId,
    applicantName: account.companyName,
    subsidyAmount: subsidyAmountFromWholesale(account),
  };
  const calculatedAmounts = calculateGrantPaymentAmounts(data.subsidyAmount);

  if (existing) {
    return client.hojoApplicationSupport.update({
      where: { id: existing.id },
      data: {
        ...data,
        ...calculatedAmounts,
        formToken: existing.formToken ?? generateApplicationFormToken(),
      },
    });
  }

  return client.hojoApplicationSupport.create({
    data: {
      ...data,
      ...calculatedAmounts,
      wholesaleAccountId: account.id,
      formToken: generateApplicationFormToken(),
      formUpdateStatus: APPLICATION_FORM_UPDATE_STATUS.UNSENT,
      grantUsageApproved: "有",
    },
  });
}

export async function syncApplicationSupportAfterWholesaleSave(
  client: PrismaLike,
  account: WholesaleSeed,
  previousGrantUsage?: string | null,
) {
  const support = await client.hojoApplicationSupport.findUnique({
    where: { wholesaleAccountId: account.id },
  });

  if (account.grantUsage === "有") {
    const ensured = await ensureApplicationSupportForWholesaleAccount(client, account);
    if (ensured.grantUsageApproved === "有") {
      await client.hojoApplicationSupport.update({
        where: { id: ensured.id },
        data: {
          grantUsagePending: null,
          grantUsageChangeRequestedAt: null,
        },
      });
    } else if (previousGrantUsage !== undefined && previousGrantUsage !== "有") {
      await client.hojoApplicationSupport.update({
        where: { id: ensured.id },
        data: {
          grantUsagePending: "有",
          grantUsageChangeRequestedAt: new Date(),
        },
      });
    }
    return;
  }

  if (support) {
    const pendingUsage =
      account.grantUsage === support.grantUsageApproved
        ? null
        : previousGrantUsage !== undefined && previousGrantUsage !== account.grantUsage && support.grantUsageApproved === "有"
          ? "無"
          : support.grantUsagePending;

    await client.hojoApplicationSupport.update({
      where: { id: support.id },
      data: {
        vendorId: account.vendorId,
        applicantName: account.companyName,
        subsidyAmount: subsidyAmountFromWholesale(account),
        ...calculateGrantPaymentAmounts(subsidyAmountFromWholesale(account)),
        grantUsagePending: pendingUsage,
        grantUsageChangeRequestedAt:
          pendingUsage && pendingUsage !== support.grantUsagePending
            ? new Date()
            : pendingUsage
              ? support.grantUsageChangeRequestedAt
              : null,
      },
    });
  }
}

export function displayApplicationFormUpdateStatus(status: string | null | undefined, formTranscriptDate: Date | string | null | undefined) {
  return formTranscriptDate ? "確定" : status || APPLICATION_FORM_UPDATE_STATUS.UNSENT;
}
