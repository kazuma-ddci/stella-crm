"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { validateCorporateNumber } from "@/lib/utils";
import { getRelatedDataCounts } from "@/lib/company/get-related-data-counts";
import type { CompanyRelatedData } from "@/types/company-merge";
import { getSession } from "@/lib/auth";

export async function deleteCompany(id: number) {
  await prisma.masterStellaCompany.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
  revalidatePath("/companies");
}

export async function getCompanyDeleteInfo(id: number): Promise<CompanyRelatedData> {
  return getRelatedDataCounts(id);
}

export async function updateCompany(
  id: number,
  data: {
    name?: string;
    nameKana?: string;
    corporateNumber?: string;
    companyType?: string;
    websiteUrl?: string;
    industry?: string;
    revenueScale?: string;
    note?: string;
    closingDay?: number | null;
    paymentMonthOffset?: number | null;
    paymentDay?: number | null;
  }
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updateData: Record<string, any> = {};

  if ("name" in data) updateData.name = data.name;
  if ("nameKana" in data) updateData.nameKana = data.nameKana || null;
  if ("corporateNumber" in data) {
    const validation = validateCorporateNumber(data.corporateNumber);
    if (!validation.valid) {
      throw new Error(validation.error!);
    }
    if (validation.normalized) {
      const existing = await prisma.masterStellaCompany.findFirst({
        where: { corporateNumber: validation.normalized, id: { not: id } },
        select: { id: true, name: true },
      });
      if (existing) {
        throw new Error(`この法人番号は既に「${existing.name}」に登録されています`);
      }
    }
    updateData.corporateNumber = validation.normalized;
  }
  if ("companyType" in data) updateData.companyType = data.companyType || null;
  if ("websiteUrl" in data) updateData.websiteUrl = data.websiteUrl || null;
  if ("industry" in data) updateData.industry = data.industry || null;
  if ("revenueScale" in data) updateData.revenueScale = data.revenueScale || null;
  if ("note" in data) updateData.note = data.note || null;
  if ("closingDay" in data) updateData.closingDay = data.closingDay ?? null;
  if ("paymentMonthOffset" in data) updateData.paymentMonthOffset = data.paymentMonthOffset ?? null;
  if ("paymentDay" in data) updateData.paymentDay = data.paymentDay ?? null;

  if (Object.keys(updateData).length > 0) {
    await prisma.masterStellaCompany.update({
      where: { id },
      data: updateData,
    });
  }

  // 設計書8.6: 名称変更時、紐づくCounterpartyの名称も同期更新
  if ("name" in data && data.name) {
    try {
      const session = await getSession();
      await prisma.counterparty.updateMany({
        where: { companyId: id, deletedAt: null, mergedIntoId: null },
        data: { name: data.name, updatedBy: session.id },
      });
      revalidatePath("/accounting/masters/counterparties");
    } catch {
      // 同期失敗時は無視
    }
  }

  revalidatePath("/companies");
  revalidatePath(`/companies/${id}`);
}
