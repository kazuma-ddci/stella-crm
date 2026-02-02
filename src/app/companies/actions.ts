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
      note: (data.note as string) || null,
    },
  });
  revalidatePath("/companies");
}

export async function updateCompany(id: number, data: Record<string, unknown>) {
  const staffId = data.staffId ? parseInt(data.staffId as string, 10) : null;

  await prisma.masterStellaCompany.update({
    where: { id },
    data: {
      name: data.name as string,
      websiteUrl: (data.websiteUrl as string) || null,
      industry: (data.industry as string) || null,
      revenueScale: (data.revenueScale as string) || null,
      staffId,
      note: (data.note as string) || null,
    },
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
    },
  });
  revalidatePath("/companies");
  return company;
}
