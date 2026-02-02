"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

export async function getContacts(companyId: number) {
  const contacts = await prisma.stellaCompanyContact.findMany({
    where: { companyId, deletedAt: null },
    orderBy: [{ isPrimary: "desc" }, { id: "asc" }],
  });
  return contacts.map((c) => ({
    id: c.id,
    companyId: c.companyId,
    name: c.name,
    email: c.email,
    phone: c.phone,
    department: c.department,
    isPrimary: c.isPrimary,
    note: c.note,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  }));
}

export async function addContact(
  companyId: number,
  data: Record<string, unknown>
) {
  // isPrimary が true の場合、他の連絡先の isPrimary を false にする
  if (data.isPrimary) {
    await prisma.stellaCompanyContact.updateMany({
      where: { companyId, isPrimary: true, deletedAt: null },
      data: { isPrimary: false },
    });
  }

  const contact = await prisma.stellaCompanyContact.create({
    data: {
      companyId,
      name: data.name as string,
      email: (data.email as string) || null,
      phone: (data.phone as string) || null,
      department: (data.department as string) || null,
      isPrimary: (data.isPrimary as boolean) || false,
      note: (data.note as string) || null,
    },
  });

  revalidatePath("/companies");
  return {
    id: contact.id,
    companyId: contact.companyId,
    name: contact.name,
    email: contact.email,
    phone: contact.phone,
    department: contact.department,
    isPrimary: contact.isPrimary,
    note: contact.note,
    createdAt: contact.createdAt.toISOString(),
    updatedAt: contact.updatedAt.toISOString(),
  };
}

export async function updateContact(
  id: number,
  data: Record<string, unknown>
) {
  const existing = await prisma.stellaCompanyContact.findUnique({
    where: { id },
  });
  if (!existing) throw new Error("Contact not found");

  // isPrimary が true の場合、他の連絡先の isPrimary を false にする
  if (data.isPrimary) {
    await prisma.stellaCompanyContact.updateMany({
      where: { companyId: existing.companyId, isPrimary: true, deletedAt: null, NOT: { id } },
      data: { isPrimary: false },
    });
  }

  const contact = await prisma.stellaCompanyContact.update({
    where: { id },
    data: {
      name: data.name as string,
      email: (data.email as string) || null,
      phone: (data.phone as string) || null,
      department: (data.department as string) || null,
      isPrimary: (data.isPrimary as boolean) || false,
      note: (data.note as string) || null,
    },
  });

  revalidatePath("/companies");
  return {
    id: contact.id,
    companyId: contact.companyId,
    name: contact.name,
    email: contact.email,
    phone: contact.phone,
    department: contact.department,
    isPrimary: contact.isPrimary,
    note: contact.note,
    createdAt: contact.createdAt.toISOString(),
    updatedAt: contact.updatedAt.toISOString(),
  };
}

export async function deleteContact(id: number) {
  // 論理削除：deletedAtに現在日時を設定
  await prisma.stellaCompanyContact.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
  revalidatePath("/companies");
}

// 部署一覧を動的に取得（既存データから）
export async function getDepartments(): Promise<string[]> {
  const contacts = await prisma.stellaCompanyContact.findMany({
    where: { department: { not: null }, deletedAt: null },
    select: { department: true },
    distinct: ["department"],
  });
  return contacts
    .map((c) => c.department)
    .filter((d): d is string => d !== null)
    .sort();
}
