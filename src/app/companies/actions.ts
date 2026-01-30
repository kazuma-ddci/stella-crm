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

  await prisma.masterStellaCompany.create({
    data: {
      companyCode,
      name: data.name as string,
      contactPerson: (data.contactPerson as string) || null,
      email: (data.email as string) || null,
      phone: (data.phone as string) || null,
      note: (data.note as string) || null,
    },
  });
  revalidatePath("/companies");
}

export async function updateCompany(id: number, data: Record<string, unknown>) {
  await prisma.masterStellaCompany.update({
    where: { id },
    data: {
      name: data.name as string,
      contactPerson: (data.contactPerson as string) || null,
      email: (data.email as string) || null,
      phone: (data.phone as string) || null,
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
  contactPerson?: string;
  email?: string;
  phone?: string;
  note?: string;
}) {
  const companyCode = await generateCompanyCode();

  const company = await prisma.masterStellaCompany.create({
    data: {
      companyCode,
      name: data.name,
      contactPerson: data.contactPerson || null,
      email: data.email || null,
      phone: data.phone || null,
      note: data.note || null,
    },
  });
  revalidatePath("/companies");
  return company;
}
