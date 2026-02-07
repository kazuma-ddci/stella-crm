"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

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

  await prisma.masterStellaCompany.create({
    data: {
      companyCode,
      name: data.name as string,
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
  await prisma.masterStellaCompany.delete({
    where: { id },
  });
  revalidatePath("/companies");
}

// For backward compatibility with company-form.tsx
export async function createCompany(data: {
  name: string;
  websiteUrl?: string;
  industry?: string;
  revenueScale?: string;
  note?: string;
  closingDay?: number | null;
  paymentMonthOffset?: number | null;
  paymentDay?: number | null;
}) {
  const companyCode = await generateCompanyCode();

  const company = await prisma.masterStellaCompany.create({
    data: {
      companyCode,
      name: data.name,
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
