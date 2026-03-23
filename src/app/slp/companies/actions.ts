"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireEdit } from "@/lib/auth";
import { validateCorporateNumber } from "@/lib/utils";
import { validateStaffForField } from "@/lib/staff/get-staff-by-field";

// 全顧客マスタと同期するフィールド
const SYNC_FIELDS = ["corporateNumber", "industry", "employeeCount", "revenueScale"] as const;

export async function addSlpCompany(data: Record<string, unknown>) {
  await requireEdit("slp");

  const companyId = Number(data.companyId);

  // 企業IDの重複チェック
  const existing = await prisma.slpCompany.findFirst({
    where: { companyId },
    select: { id: true },
  });
  if (existing) {
    throw new Error(
      `この企業はすでにSLP案件に登録されています（No. ${existing.id}）`
    );
  }

  // スタッフ権限バリデーション
  if (data.consultantStaffId) {
    const isValid = await validateStaffForField("SLP_COMPANY_CONSULTANT", Number(data.consultantStaffId));
    if (!isValid) throw new Error("選択された担当コンサルはこのフィールドに割り当てできません");
  }
  if (data.csStaffId) {
    const isValid = await validateStaffForField("SLP_COMPANY_CS", Number(data.csStaffId));
    if (!isValid) throw new Error("選択された担当CSはこのフィールドに割り当てできません");
  }

  await prisma.slpCompany.create({
    data: {
      companyId,
      annualLaborCost: data.annualLaborCost ? Number(data.annualLaborCost) : null,
      targetEmployeeCount: data.targetEmployeeCount ? Number(data.targetEmployeeCount) : null,
      targetEstimateRate: data.targetEstimateRate ? Number(data.targetEstimateRate) : null,
      consultantStaffId: data.consultantStaffId ? Number(data.consultantStaffId) : null,
      csStaffId: data.csStaffId ? Number(data.csStaffId) : null,
      agentCompanyId: data.agentCompanyId ? Number(data.agentCompanyId) : null,
      note: (data.note as string) || null,
    },
  });

  revalidatePath("/slp/companies");
}

export async function updateSlpCompany(id: number, data: Record<string, unknown>) {
  await requireEdit("slp");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const slpUpdateData: Record<string, any> = {};
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const masterUpdateData: Record<string, any> = {};

  // SLP固有フィールド
  if ("annualLaborCost" in data) {
    slpUpdateData.annualLaborCost = data.annualLaborCost ? Number(data.annualLaborCost) : null;
  }
  if ("targetEmployeeCount" in data) {
    slpUpdateData.targetEmployeeCount = data.targetEmployeeCount ? Number(data.targetEmployeeCount) : null;
  }
  if ("targetEstimateRate" in data) {
    slpUpdateData.targetEstimateRate = data.targetEstimateRate ? Number(data.targetEstimateRate) : null;
  }
  if ("note" in data) {
    slpUpdateData.note = (data.note as string) || null;
  }

  // 担当コンサル
  if ("consultantStaffId" in data) {
    const staffId = data.consultantStaffId ? Number(data.consultantStaffId) : null;
    if (staffId) {
      const isValid = await validateStaffForField("SLP_COMPANY_CONSULTANT", staffId);
      if (!isValid) throw new Error("選択された担当コンサルはこのフィールドに割り当てできません");
    }
    slpUpdateData.consultantStaffId = staffId;
  }

  // 担当CS
  if ("csStaffId" in data) {
    const staffId = data.csStaffId ? Number(data.csStaffId) : null;
    if (staffId) {
      const isValid = await validateStaffForField("SLP_COMPANY_CS", staffId);
      if (!isValid) throw new Error("選択された担当CSはこのフィールドに割り当てできません");
    }
    slpUpdateData.csStaffId = staffId;
  }

  // 代理店
  if ("agentCompanyId" in data) {
    slpUpdateData.agentCompanyId = data.agentCompanyId ? Number(data.agentCompanyId) : null;
  }

  // 同期フィールド（全顧客マスタに書き込む）
  if ("corporateNumber" in data) {
    const validation = validateCorporateNumber(data.corporateNumber as string);
    if (!validation.valid) {
      throw new Error(validation.error!);
    }
    masterUpdateData.corporateNumber = validation.normalized;
  }
  if ("industry" in data) {
    masterUpdateData.industry = (data.industry as string) || null;
  }
  if ("employeeCount" in data) {
    masterUpdateData.employeeCount = data.employeeCount ? Number(data.employeeCount) : null;
  }
  if ("revenueScale" in data) {
    masterUpdateData.revenueScale = (data.revenueScale as string) || null;
  }

  const hasSyncFields = Object.keys(masterUpdateData).length > 0;

  if (hasSyncFields) {
    // トランザクションでSlpCompanyと全顧客マスタを同時更新
    const slpCompany = await prisma.slpCompany.findUnique({
      where: { id },
      select: { companyId: true },
    });
    if (!slpCompany) throw new Error("案件が見つかりません");

    // 法人番号のユニークチェック（自身を除外）
    if (masterUpdateData.corporateNumber) {
      const existing = await prisma.masterStellaCompany.findFirst({
        where: {
          corporateNumber: masterUpdateData.corporateNumber,
          id: { not: slpCompany.companyId },
        },
        select: { id: true, name: true },
      });
      if (existing) {
        throw new Error(`この法人番号は既に「${existing.name}」に登録されています`);
      }
    }

    await prisma.$transaction(async (tx) => {
      if (Object.keys(slpUpdateData).length > 0) {
        await tx.slpCompany.update({ where: { id }, data: slpUpdateData });
      }
      await tx.masterStellaCompany.update({
        where: { id: slpCompany.companyId },
        data: masterUpdateData,
      });
    });
  } else if (Object.keys(slpUpdateData).length > 0) {
    await prisma.slpCompany.update({ where: { id }, data: slpUpdateData });
  }

  revalidatePath("/slp/companies");
}

export async function deleteSlpCompany(id: number) {
  await requireEdit("slp");
  await prisma.slpCompany.delete({ where: { id } });
  revalidatePath("/slp/companies");
}

export async function checkDuplicateSlpCompanyId(
  companyId: number
): Promise<{ isDuplicate: boolean; slpCompanyId?: number }> {
  const existing = await prisma.slpCompany.findFirst({
    where: { companyId },
    select: { id: true },
  });
  if (existing) {
    return { isDuplicate: true, slpCompanyId: existing.id };
  }
  return { isDuplicate: false };
}
