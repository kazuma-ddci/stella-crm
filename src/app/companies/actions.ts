"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { normalizeCompanyName, normalizeCorporateNumber, validateCorporateNumber } from "@/lib/utils";
import { getRelatedDataCounts } from "@/lib/company/get-related-data-counts";
import type { CompanyRelatedData } from "@/types/company-merge";

async function generateCompanyCode(): Promise<string> {
  const lastCompany = await prisma.masterStellaCompany.findFirst({
    orderBy: { id: "desc" },
  });

  if (!lastCompany) {
    return "SC-1";
  }

  const match = lastCompany.companyCode.match(/SC-(\d+)/);
  const nextNumber = match ? parseInt(match[1], 10) + 1 : 1;
  return `SC-${nextNumber}`;
}

export async function addCompany(data: Record<string, unknown>) {
  const companyCode = await generateCompanyCode();
  const staffId = data.staffId ? parseInt(data.staffId as string, 10) : null;

  // 法人番号のバリデーション+正規化
  const corporateNumberInput = (data.corporateNumber as string) || null;
  const validation = validateCorporateNumber(corporateNumberInput);
  if (!validation.valid) {
    throw new Error(validation.error!);
  }

  // ユニークチェック
  if (validation.normalized) {
    const existing = await prisma.masterStellaCompany.findFirst({
      where: { corporateNumber: validation.normalized },
      select: { id: true, name: true },
    });
    if (existing) {
      throw new Error(`この法人番号は既に「${existing.name}」に登録されています`);
    }
  }

  await prisma.masterStellaCompany.create({
    data: {
      companyCode,
      name: data.name as string,
      nameKana: (data.nameKana as string) || null,
      corporateNumber: validation.normalized,
      companyType: (data.companyType as string) || null,
      websiteUrl: (data.websiteUrl as string) || null,
      industry: (data.industry as string) || null,
      revenueScale: (data.revenueScale as string) || null,
      staffId,
      leadSource: (data.leadSource as string) || null,
      note: (data.note as string) || null,
      closingDay: data.closingDay != null ? Number(data.closingDay) : null,
      paymentMonthOffset: data.paymentMonthOffset != null ? Number(data.paymentMonthOffset) : null,
      paymentDay: data.paymentDay != null ? Number(data.paymentDay) : null,
    },
  });
  revalidatePath("/companies");
}

export async function updateCompany(id: number, data: Record<string, unknown>) {
  const staffId = data.staffId ? parseInt(data.staffId as string, 10) : null;

  // 更新データを動的に構築（渡されたフィールドのみを更新）
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updateData: Record<string, any> = {};

  if ("name" in data) updateData.name = data.name as string;
  if ("nameKana" in data) updateData.nameKana = (data.nameKana as string) || null;
  if ("corporateNumber" in data) {
    const validation = validateCorporateNumber(data.corporateNumber as string);
    if (!validation.valid) {
      throw new Error(validation.error!);
    }
    // ユニークチェック（自分自身を除外）
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
  if ("companyType" in data) updateData.companyType = (data.companyType as string) || null;
  if ("websiteUrl" in data) updateData.websiteUrl = (data.websiteUrl as string) || null;
  if ("industry" in data) updateData.industry = (data.industry as string) || null;
  if ("revenueScale" in data) updateData.revenueScale = (data.revenueScale as string) || null;
  if ("staffId" in data) updateData.staffId = staffId;
  if ("leadSource" in data) updateData.leadSource = (data.leadSource as string) || null;
  if ("note" in data) updateData.note = (data.note as string) || null;
  if ("closingDay" in data) updateData.closingDay = data.closingDay != null ? Number(data.closingDay) : null;
  if ("paymentMonthOffset" in data) updateData.paymentMonthOffset = data.paymentMonthOffset != null ? Number(data.paymentMonthOffset) : null;
  if ("paymentDay" in data) updateData.paymentDay = data.paymentDay != null ? Number(data.paymentDay) : null;

  await prisma.masterStellaCompany.update({
    where: { id },
    data: updateData,
  });
  revalidatePath("/companies");
}

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

// For backward compatibility with company-form.tsx
export async function createCompany(data: {
  name: string;
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
}) {
  const companyCode = await generateCompanyCode();

  // 法人番号のバリデーション+正規化
  const validation = validateCorporateNumber(data.corporateNumber);
  if (!validation.valid) {
    throw new Error(validation.error!);
  }

  // ユニークチェック
  if (validation.normalized) {
    const existing = await prisma.masterStellaCompany.findFirst({
      where: { corporateNumber: validation.normalized },
      select: { id: true, name: true },
    });
    if (existing) {
      throw new Error(`この法人番号は既に「${existing.name}」に登録されています`);
    }
  }

  const company = await prisma.masterStellaCompany.create({
    data: {
      companyCode,
      name: data.name,
      nameKana: data.nameKana || null,
      corporateNumber: validation.normalized,
      companyType: data.companyType || null,
      websiteUrl: data.websiteUrl || null,
      industry: data.industry || null,
      revenueScale: data.revenueScale || null,
      note: data.note || null,
      ...(data.closingDay !== undefined && { closingDay: data.closingDay }),
      ...(data.paymentMonthOffset !== undefined && { paymentMonthOffset: data.paymentMonthOffset }),
      ...(data.paymentDay !== undefined && { paymentDay: data.paymentDay }),
    },
  });
  revalidatePath("/companies");
  return company;
}

export type SimilarCompany = {
  id: number;
  companyCode: string;
  name: string;
  corporateNumber: string | null;
  industry: string | null;
  matchType: "exact" | "similar" | "corporateNumber";
};

/**
 * 企業名または法人番号で類似企業を検索する。
 * - 正規化後の完全一致
 * - 正規化後の部分一致（contains）
 * - 法人番号の完全一致
 */
export async function searchSimilarCompanies(
  name: string,
  corporateNumber?: string,
  excludeId?: number
): Promise<SimilarCompany[]> {
  if (!name || name.trim().length < 2) return [];

  const normalizedInput = normalizeCompanyName(name);

  // 全企業を取得して正規化比較（DBレベルの正規化が難しいため）
  const allCompanies = await prisma.masterStellaCompany.findMany({
    where: { deletedAt: null, ...(excludeId ? { id: { not: excludeId } } : {}) },
    select: {
      id: true,
      companyCode: true,
      name: true,
      corporateNumber: true,
      industry: true,
    },
    orderBy: { id: "asc" },
  });

  const results: SimilarCompany[] = [];
  const seen = new Set<number>();

  // 法人番号の完全一致チェック（正規化して比較）
  if (corporateNumber && corporateNumber.trim().length > 0) {
    const normalizedCN = normalizeCorporateNumber(corporateNumber);
    for (const company of allCompanies) {
      if (company.corporateNumber && company.corporateNumber === normalizedCN) {
        results.push({ ...company, matchType: "corporateNumber" });
        seen.add(company.id);
      }
    }
  }

  // 企業名の正規化比較
  for (const company of allCompanies) {
    if (seen.has(company.id)) continue;

    const normalizedExisting = normalizeCompanyName(company.name);

    if (normalizedExisting === normalizedInput) {
      results.push({ ...company, matchType: "exact" });
      seen.add(company.id);
    } else if (
      normalizedExisting.includes(normalizedInput) ||
      normalizedInput.includes(normalizedExisting)
    ) {
      results.push({ ...company, matchType: "similar" });
      seen.add(company.id);
    }
  }

  return results.slice(0, 10);
}
