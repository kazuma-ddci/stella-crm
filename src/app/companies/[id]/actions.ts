"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { validateCorporateNumber } from "@/lib/utils";

export async function deleteCompany(id: number) {
  await prisma.masterStellaCompany.delete({
    where: { id },
  });
  revalidatePath("/companies");
}

export async function updateCompany(
  id: number,
  data: {
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
  }
) {
  // 法人番号のバリデーション+正規化
  const validation = validateCorporateNumber(data.corporateNumber);
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

  await prisma.masterStellaCompany.update({
    where: { id },
    data: {
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
  revalidatePath(`/companies/${id}`);
}
