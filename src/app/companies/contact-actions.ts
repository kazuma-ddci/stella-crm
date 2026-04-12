"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { ok, err, type ActionResult } from "@/lib/action-result";
import { requireStaffWithAnyEditPermission } from "@/lib/auth/staff-action";

type ContactDto = {
  id: number;
  companyId: number;
  name: string;
  email: string | null;
  phone: string | null;
  department: string | null;
  isPrimary: boolean;
  note: string | null;
  createdAt: string;
  updatedAt: string;
};

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
): Promise<ActionResult<ContactDto>> {
  // 認証: 社内スタッフ + いずれかのプロジェクトで edit 以上
  // 注: getSession() の redirect を伝播させるため try/catch の外で呼ぶ
  await requireStaffWithAnyEditPermission();
  try {
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
    return ok({
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
    });
  } catch (e) {
    console.error("[addContact] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
}

export async function updateContact(
  id: number,
  data: Record<string, unknown>
): Promise<ActionResult<ContactDto>> {
  await requireStaffWithAnyEditPermission();
  try {
    const existing = await prisma.stellaCompanyContact.findUnique({
      where: { id },
    });
    if (!existing) return err("担当者が見つかりません");

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
    return ok({
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
    });
  } catch (e) {
    console.error("[updateContact] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
}

export async function deleteContact(id: number): Promise<ActionResult> {
  await requireStaffWithAnyEditPermission();
  try {
    // 論理削除：deletedAtに現在日時を設定
    await prisma.stellaCompanyContact.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    revalidatePath("/companies");
    return ok();
  } catch (e) {
    console.error("[deleteContact] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
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
