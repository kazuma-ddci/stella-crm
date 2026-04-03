"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireProjectMasterDataEditPermission } from "@/lib/auth/master-data-permission";

function toDateOrNull(val: unknown): Date | null {
  if (!val) return null;
  const d = new Date(String(val));
  return isNaN(d.getTime()) ? null : d;
}

function toDecimalOrNull(val: unknown): number | null {
  if (val === null || val === undefined || val === "") return null;
  const n = Number(val);
  return isNaN(n) ? null : n;
}

function toIntOrNull(val: unknown): number | null {
  if (val === null || val === undefined || val === "") return null;
  const n = parseInt(String(val), 10);
  return isNaN(n) ? null : n;
}

function toStr(val: unknown): string | null {
  if (val === null || val === undefined || val === "") return null;
  return String(val).trim();
}

export async function addPostApplication(data: Record<string, unknown>) {
  await requireProjectMasterDataEditPermission();

  const vendorId = data.vendorId ? Number(data.vendorId) : null;
  if (!vendorId) throw new Error("ベンダーを選択してください");

  await prisma.hojoGrantCustomerPostApplication.create({
    data: {
      vendor: { connect: { id: vendorId } },
      applicantName: toStr(data.applicantName),
      grantApplicationNumber: toStr(data.grantApplicationNumber),
      subsidyStatus: toStr(data.subsidyStatus),
      applicationCompletedDate: toDateOrNull(data.applicationCompletedDate),
      hasLoan: data.hasLoan === true || data.hasLoan === "true",
    },
  });

  revalidatePath("/hojo/grant-customers/post-application");
}

export async function updatePostApplication(id: number, data: Record<string, unknown>) {
  await requireProjectMasterDataEditPermission();

  const updateData: Record<string, unknown> = {};

  if ("vendorId" in data) {
    const vendorId = data.vendorId ? Number(data.vendorId) : null;
    if (vendorId) {
      updateData.vendor = { connect: { id: vendorId } };
    }
  }
  if ("applicantName" in data) updateData.applicantName = toStr(data.applicantName);
  if ("grantApplicationNumber" in data) updateData.grantApplicationNumber = toStr(data.grantApplicationNumber);
  if ("subsidyStatus" in data) updateData.subsidyStatus = toStr(data.subsidyStatus);
  if ("applicationCompletedDate" in data) updateData.applicationCompletedDate = toDateOrNull(data.applicationCompletedDate);
  if ("hasLoan" in data) updateData.hasLoan = data.hasLoan === true || data.hasLoan === "true";
  if ("completedDate" in data) updateData.completedDate = toDateOrNull(data.completedDate);

  if (Object.keys(updateData).length > 0) {
    await prisma.hojoGrantCustomerPostApplication.update({
      where: { id },
      data: updateData,
    });
  }

  revalidatePath("/hojo/grant-customers/post-application");
}

export async function deletePostApplication(id: number) {
  await requireProjectMasterDataEditPermission();

  await prisma.hojoGrantCustomerPostApplication.update({
    where: { id },
    data: { deletedAt: new Date() },
  });

  revalidatePath("/hojo/grant-customers/post-application");
}

export async function updatePostApplicationDetail(
  id: number,
  data: Record<string, unknown>
) {
  await requireProjectMasterDataEditPermission();

  const updateData: Record<string, unknown> = {};

  // Vendor
  if ("vendorId" in data) {
    const vendorId = data.vendorId ? Number(data.vendorId) : null;
    if (vendorId) {
      updateData.vendor = { connect: { id: vendorId } };
    }
  }

  // PreApplication link
  if ("preApplicationId" in data) {
    const preId = data.preApplicationId ? Number(data.preApplicationId) : null;
    if (preId) {
      updateData.preApplication = { connect: { id: preId } };
    } else {
      updateData.preApplication = { disconnect: true };
    }
  }

  // String fields
  const strFields = [
    "applicantName", "memo", "referrer", "salesStaff",
    "applicationStaff", "grantApplicationNumber", "nextAction",
    "documentStorageUrl", "existingDocuments", "staffEmail",
    "growthMatchingUrl", "growthMatchingStatus", "wageRaise",
    "laborSavingNavi", "invoiceRegistration", "repeatJudgment",
    "subsidyApplicantName", "prefecture", "recruitmentRound",
    "applicationType", "subsidyStatus", "subsidyVendorName",
    "itToolName",
    "deliveryCompleted", "employeeListUrl", "employeeListFormUrl",
    "employeeListCreated", "performanceReportCompleted",
    "confirmationCompleted", "grantCompleted",
    "refundCompleted", "subsidyPaymentCompleted",
    "loanSurveyResponse", "loanMtgCompleted", "loanMtgStaff",
    "loanLocation", "loanCash", "loanDoubleChecker",
    "loanTime", "loanPaymentCompleted",
    "referrerNumber", "referrerLineName", "referrerPaymentCompleted",
    "agent1Number", "agent1LineName", "agent1PaymentCompleted",
    "agent2Number", "agent2LineName", "agent2PaymentCompleted",
    "agent3Number", "agent3LineName", "agent3PaymentCompleted",
    "vendorPattern", "toolPattern",
    "wageTable1", "wageTable2", "wageTable3", "wageTable4", "wageTable5",
    "wageTable6", "wageTable7", "wageTable8", "wageTable9", "wageTable10",
  ];
  for (const f of strFields) {
    if (f in data) updateData[f] = toStr(data[f]);
  }

  // Boolean fields
  if ("isBpo" in data) updateData.isBpo = data.isBpo === true || data.isBpo === "true";
  if ("hasLoan" in data) updateData.hasLoan = data.hasLoan === true || data.hasLoan === "true";

  // Date fields
  const dateFields = [
    "applicationCompletedDate", "nextContactDate", "subsidyStatusUpdated",
    "grantDecisionDate", "confirmationApprovalDate",
    "deliveryDate", "performanceReportDate", "confirmationDate",
    "grantDate", "refundDate", "subsidyPaymentDate", "completedDate",
    "loanMtgDate", "loanPaymentDate",
    "referrerPaymentDate", "agent1PaymentDate",
    "agent2PaymentDate", "agent3PaymentDate",
  ];
  for (const f of dateFields) {
    if (f in data) updateData[f] = toDateOrNull(data[f]);
  }

  // Decimal fields
  const decimalFields = [
    "loanAmount",
    "referrerPct", "referrerAmount",
    "agent1Pct", "agent1Amount",
    "agent2Pct", "agent2Amount",
    "agent3Pct", "agent3Amount",
  ];
  for (const f of decimalFields) {
    if (f in data) updateData[f] = toDecimalOrNull(data[f]);
  }

  // Int fields
  const intFields = [
    "subsidyTargetAmount", "subsidyAppliedAmount",
    "grantDecisionAmount", "subsidyConfirmedAmount",
  ];
  for (const f of intFields) {
    if (f in data) updateData[f] = toIntOrNull(data[f]);
  }

  if (Object.keys(updateData).length > 0) {
    await prisma.hojoGrantCustomerPostApplication.update({
      where: { id },
      data: updateData,
    });
  }

  revalidatePath("/hojo/grant-customers/post-application");
  revalidatePath(`/hojo/grant-customers/post-application/${id}`);
}
