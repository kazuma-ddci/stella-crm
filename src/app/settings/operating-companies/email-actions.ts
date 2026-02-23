"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireMasterDataEditPermission } from "@/lib/auth/master-data-permission";
import { getSession } from "@/lib/auth/session";

export async function addOperatingCompanyEmail(
  operatingCompanyId: number,
  data: Record<string, unknown>
) {
  await requireMasterDataEditPermission();
  const session = await getSession();
  const staffId = session.id;

  const email = await prisma.operatingCompanyEmail.create({
    data: {
      operatingCompanyId,
      email: data.email as string,
      label: (data.label as string) || null,
      smtpHost: (data.smtpHost as string) || null,
      smtpPort: data.smtpPort ? Number(data.smtpPort) : null,
      smtpUser: (data.smtpUser as string) || null,
      smtpPass: (data.smtpPass as string) || null,
      isDefault: data.isDefault === true || data.isDefault === "true",
      createdBy: staffId,
    },
  });

  // isDefaultがtrueの場合、同じ法人の他のメールのisDefaultをfalseにする
  if (email.isDefault) {
    await prisma.operatingCompanyEmail.updateMany({
      where: {
        operatingCompanyId,
        id: { not: email.id },
        deletedAt: null,
      },
      data: { isDefault: false },
    });
  }

  revalidatePath("/settings/operating-companies");
  return {
    id: email.id,
    operatingCompanyId: email.operatingCompanyId,
    email: email.email,
    label: email.label,
    smtpHost: email.smtpHost,
    smtpPort: email.smtpPort,
    smtpUser: email.smtpUser,
    smtpPass: email.smtpPass,
    isDefault: email.isDefault,
    createdAt: email.createdAt.toISOString(),
    updatedAt: email.updatedAt.toISOString(),
  };
}

export async function updateOperatingCompanyEmail(
  id: number,
  data: Record<string, unknown>
) {
  await requireMasterDataEditPermission();
  const session = await getSession();
  const staffId = session.id;

  const existing = await prisma.operatingCompanyEmail.findUnique({
    where: { id },
  });
  if (!existing) throw new Error("メールアドレスが見つかりません");

  const isDefault = data.isDefault === true || data.isDefault === "true";

  const email = await prisma.operatingCompanyEmail.update({
    where: { id },
    data: {
      email: data.email as string,
      label: (data.label as string) || null,
      smtpHost: (data.smtpHost as string) || null,
      smtpPort: data.smtpPort ? Number(data.smtpPort) : null,
      smtpUser: (data.smtpUser as string) || null,
      smtpPass: (data.smtpPass as string) || null,
      isDefault,
      updatedBy: staffId,
    },
  });

  // isDefaultがtrueの場合、同じ法人の他のメールのisDefaultをfalseにする
  if (isDefault) {
    await prisma.operatingCompanyEmail.updateMany({
      where: {
        operatingCompanyId: existing.operatingCompanyId,
        id: { not: email.id },
        deletedAt: null,
      },
      data: { isDefault: false },
    });
  }

  revalidatePath("/settings/operating-companies");
  return {
    id: email.id,
    operatingCompanyId: email.operatingCompanyId,
    email: email.email,
    label: email.label,
    smtpHost: email.smtpHost,
    smtpPort: email.smtpPort,
    smtpUser: email.smtpUser,
    smtpPass: email.smtpPass,
    isDefault: email.isDefault,
    createdAt: email.createdAt.toISOString(),
    updatedAt: email.updatedAt.toISOString(),
  };
}

export async function deleteOperatingCompanyEmail(id: number) {
  await requireMasterDataEditPermission();
  await prisma.operatingCompanyEmail.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
  revalidatePath("/settings/operating-companies");
}
