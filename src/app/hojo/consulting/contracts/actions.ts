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

export async function addContract(data: Record<string, unknown>) {
  await requireProjectMasterDataEditPermission();

  const vendorId = data.vendorId ? Number(data.vendorId) : null;
  if (!vendorId) throw new Error("ベンダーを選択してください");

  await prisma.hojoConsultingContract.create({
    data: {
      vendor: { connect: { id: vendorId } },
      lineNumber: data.lineNumber ? String(data.lineNumber).trim() : null,
      lineName: data.lineName ? String(data.lineName).trim() : null,
      referralUrl: data.referralUrl ? String(data.referralUrl).trim() : null,
      assignedAs: data.assignedAs ? String(data.assignedAs).trim() : null,
      consultingStaff: data.consultingStaff ? String(data.consultingStaff).trim() : null,
      companyName: String(data.companyName || "").trim(),
      representativeName: data.representativeName ? String(data.representativeName).trim() : null,
      mainContactName: data.mainContactName ? String(data.mainContactName).trim() : null,
      customerEmail: data.customerEmail ? String(data.customerEmail).trim() : null,
      customerPhone: data.customerPhone ? String(data.customerPhone).trim() : null,
      contractDate: toDateOrNull(data.contractDate),
      contractPlan: data.contractPlan ? String(data.contractPlan).trim() : null,
      contractAmount: toDecimalOrNull(data.contractAmount),
      serviceType: data.serviceType ? String(data.serviceType).trim() : null,
      caseStatus: data.caseStatus ? String(data.caseStatus).trim() : null,
      hasScSales: data.hasScSales === true || data.hasScSales === "true",
      hasSubsidyConsulting: data.hasSubsidyConsulting === true || data.hasSubsidyConsulting === "true",
      hasBpoSupport: data.hasBpoSupport === true || data.hasBpoSupport === "true",
      consultingPlan: data.consultingPlan ? String(data.consultingPlan).trim() : null,
      successFee: toDecimalOrNull(data.successFee),
      startDate: toDateOrNull(data.startDate),
      endDate: toDateOrNull(data.endDate),
      billingStatus: data.billingStatus ? String(data.billingStatus).trim() : null,
      paymentStatus: data.paymentStatus ? String(data.paymentStatus).trim() : null,
      revenueRecordingDate: toDateOrNull(data.revenueRecordingDate),
      grossProfit: toDecimalOrNull(data.grossProfit),
      notes: data.notes ? String(data.notes).trim() : null,
    },
  });

  revalidatePath("/hojo/consulting/contracts");
}

export async function updateContract(id: number, data: Record<string, unknown>) {
  await requireProjectMasterDataEditPermission();

  const updateData: Record<string, unknown> = {};

  if ("vendorId" in data) {
    const vendorId = data.vendorId ? Number(data.vendorId) : null;
    if (vendorId) {
      updateData.vendor = { connect: { id: vendorId } };
    }
  }
  if ("lineNumber" in data) updateData.lineNumber = data.lineNumber ? String(data.lineNumber).trim() : null;
  if ("lineName" in data) updateData.lineName = data.lineName ? String(data.lineName).trim() : null;
  if ("referralUrl" in data) updateData.referralUrl = data.referralUrl ? String(data.referralUrl).trim() : null;
  if ("assignedAs" in data) updateData.assignedAs = data.assignedAs ? String(data.assignedAs).trim() : null;
  if ("consultingStaff" in data) updateData.consultingStaff = data.consultingStaff ? String(data.consultingStaff).trim() : null;
  if ("companyName" in data) updateData.companyName = String(data.companyName || "").trim();
  if ("representativeName" in data) updateData.representativeName = data.representativeName ? String(data.representativeName).trim() : null;
  if ("mainContactName" in data) updateData.mainContactName = data.mainContactName ? String(data.mainContactName).trim() : null;
  if ("customerEmail" in data) updateData.customerEmail = data.customerEmail ? String(data.customerEmail).trim() : null;
  if ("customerPhone" in data) updateData.customerPhone = data.customerPhone ? String(data.customerPhone).trim() : null;
  if ("contractDate" in data) updateData.contractDate = toDateOrNull(data.contractDate);
  if ("contractPlan" in data) updateData.contractPlan = data.contractPlan ? String(data.contractPlan).trim() : null;
  if ("contractAmount" in data) updateData.contractAmount = toDecimalOrNull(data.contractAmount);
  if ("serviceType" in data) updateData.serviceType = data.serviceType ? String(data.serviceType).trim() : null;
  if ("caseStatus" in data) updateData.caseStatus = data.caseStatus ? String(data.caseStatus).trim() : null;
  if ("hasScSales" in data) updateData.hasScSales = data.hasScSales === true || data.hasScSales === "true";
  if ("hasSubsidyConsulting" in data) updateData.hasSubsidyConsulting = data.hasSubsidyConsulting === true || data.hasSubsidyConsulting === "true";
  if ("hasBpoSupport" in data) updateData.hasBpoSupport = data.hasBpoSupport === true || data.hasBpoSupport === "true";
  if ("consultingPlan" in data) updateData.consultingPlan = data.consultingPlan ? String(data.consultingPlan).trim() : null;
  if ("successFee" in data) updateData.successFee = toDecimalOrNull(data.successFee);
  if ("startDate" in data) updateData.startDate = toDateOrNull(data.startDate);
  if ("endDate" in data) updateData.endDate = toDateOrNull(data.endDate);
  if ("billingStatus" in data) updateData.billingStatus = data.billingStatus ? String(data.billingStatus).trim() : null;
  if ("paymentStatus" in data) updateData.paymentStatus = data.paymentStatus ? String(data.paymentStatus).trim() : null;
  if ("revenueRecordingDate" in data) updateData.revenueRecordingDate = toDateOrNull(data.revenueRecordingDate);
  if ("grossProfit" in data) updateData.grossProfit = toDecimalOrNull(data.grossProfit);
  if ("notes" in data) updateData.notes = data.notes ? String(data.notes).trim() : null;

  if (Object.keys(updateData).length > 0) {
    await prisma.hojoConsultingContract.update({
      where: { id },
      data: updateData,
    });
  }

  revalidatePath("/hojo/consulting/contracts");
}

export async function deleteContract(id: number) {
  await requireProjectMasterDataEditPermission();

  await prisma.hojoConsultingContract.update({
    where: { id },
    data: { deletedAt: new Date() },
  });

  revalidatePath("/hojo/consulting/contracts");
}
