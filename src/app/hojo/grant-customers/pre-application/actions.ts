"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireProjectMasterDataEditPermission } from "@/lib/auth/master-data-permission";
import { ok, err, type ActionResult } from "@/lib/action-result";

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

export async function addPreApplication(data: Record<string, unknown>): Promise<ActionResult> {
  try {
    await requireProjectMasterDataEditPermission();

    const vendorId = data.vendorId ? Number(data.vendorId) : null;
    if (!vendorId) return err("ベンダーを選択してください");

    await prisma.hojoGrantCustomerPreApplication.create({
      data: {
        vendor: { connect: { id: vendorId } },
        applicantName: toStr(data.applicantName),
        status: toStr(data.status),
        category: toStr(data.category),
        prospectLevel: toStr(data.prospectLevel),
        salesStaff: toStr(data.salesStaff),
        businessName: toStr(data.businessName),
        nextContactDate: toDateOrNull(data.nextContactDate),
      },
    });

    revalidatePath("/hojo/grant-customers/pre-application");
    return ok();
  } catch (e) {
    console.error("[addPreApplication] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
}

export async function updatePreApplication(id: number, data: Record<string, unknown>): Promise<ActionResult> {
  try {
    await requireProjectMasterDataEditPermission();

    const updateData: Record<string, unknown> = {};

    if ("vendorId" in data) {
      const vendorId = data.vendorId ? Number(data.vendorId) : null;
      if (vendorId) {
        updateData.vendor = { connect: { id: vendorId } };
      }
    }
    if ("applicantName" in data) updateData.applicantName = toStr(data.applicantName);
    if ("status" in data) updateData.status = toStr(data.status);
    if ("category" in data) updateData.category = toStr(data.category);
    if ("prospectLevel" in data) updateData.prospectLevel = toStr(data.prospectLevel);
    if ("salesStaff" in data) updateData.salesStaff = toStr(data.salesStaff);
    if ("businessName" in data) updateData.businessName = toStr(data.businessName);
    if ("nextContactDate" in data) updateData.nextContactDate = toDateOrNull(data.nextContactDate);

    if (Object.keys(updateData).length > 0) {
      await prisma.hojoGrantCustomerPreApplication.update({
        where: { id },
        data: updateData,
      });
    }

    revalidatePath("/hojo/grant-customers/pre-application");
    return ok();
  } catch (e) {
    console.error("[updatePreApplication] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
}

export async function deletePreApplication(id: number): Promise<ActionResult> {
  try {
    await requireProjectMasterDataEditPermission();

    await prisma.hojoGrantCustomerPreApplication.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    revalidatePath("/hojo/grant-customers/pre-application");
    return ok();
  } catch (e) {
    console.error("[deletePreApplication] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
}

export async function updatePreApplicationDetail(
  id: number,
  data: Record<string, unknown>
): Promise<ActionResult> {
  try {
  await requireProjectMasterDataEditPermission();

  const updateData: Record<string, unknown> = {};

  // Vendor
  if ("vendorId" in data) {
    const vendorId = data.vendorId ? Number(data.vendorId) : null;
    if (vendorId) {
      updateData.vendor = { connect: { id: vendorId } };
    }
  }

  // String fields
  const strFields = [
    "applicantName", "referrer", "salesStaff", "category", "status",
    "prospectLevel", "detailMemo", "nextAction", "phone",
    "briefingStaff", "businessEntity", "industry", "systemType",
    "hasLoan", "revenueRange", "importantTags", "loanPattern",
    "agent1Number", "doubleChecker", "repeatJudgment", "wageRaiseEligible",
    "pastProduct", "agentContractUrl", "businessName",
    "doc1", "doc2", "doc3", "doc4", "doc5",
    "itStrategyNaviPdf", "hasEmployees", "gbizidScreenshot",
    "gbizidAddress", "selfDeclarationId", "antiSocialCheck",
    "capital", "fiscalMonth", "capitalOrReserve",
    "planYear1", "planYear2", "planYear3",
    "bonus1Target", "bonus1Doc", "bonus2Target", "bonus2Doc", "minWage",
    "applicationSystem", "businessDescriptionDraft", "businessProcessNote",
    "homepageUrl", "businessDescription", "challengeTitle", "challengeGoal",
    "growthMatchingDescription", "dataEntryStaff", "dataEntryConfirmed",
    "businessDescriptionFinal", "industryCode",
    "wageTable1", "wageTable2", "wageTable3", "wageTable4", "wageTable5",
    "wageTable6", "wageTable7", "wageTable8", "wageTable9", "wageTable10",
    "mtgRecordingUrl",
  ];
  for (const f of strFields) {
    if (f in data) updateData[f] = toStr(data[f]);
  }

  // Date fields
  const dateFields = [
    "nextContactDate", "overviewBriefingDate", "lostDate",
    "docCollectionStart", "docSubmissionDate", "establishmentDate",
  ];
  for (const f of dateFields) {
    if (f in data) updateData[f] = toDateOrNull(data[f]);
  }

  // Decimal fields
  const decimalFields = [
    "referrerRewardPct", "agent1RewardPct", "totalReward",
    "revenue", "grossProfit", "operatingProfit", "ordinaryProfit",
    "depreciation", "laborCost", "executiveCompensation", "totalSalaryPrevYear",
  ];
  for (const f of decimalFields) {
    if (f in data) updateData[f] = toDecimalOrNull(data[f]);
  }

  // Int fields
  const intFields = [
    "officeCount", "empRegular", "empContract", "empPartTime",
    "empDispatch", "empOther",
  ];
  for (const f of intFields) {
    if (f in data) updateData[f] = toIntOrNull(data[f]);
  }

  if (Object.keys(updateData).length > 0) {
    await prisma.hojoGrantCustomerPreApplication.update({
      where: { id },
      data: updateData,
    });
  }

  revalidatePath("/hojo/grant-customers/pre-application");
  revalidatePath(`/hojo/grant-customers/pre-application/${id}`);
  return ok();
  } catch (e) {
    console.error("[updatePreApplicationDetail] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
}
