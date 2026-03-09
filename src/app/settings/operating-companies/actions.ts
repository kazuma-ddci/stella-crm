"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireMasterDataEditPermission } from "@/lib/auth/master-data-permission";

export async function addOperatingCompany(data: Record<string, unknown>) {
  await requireMasterDataEditPermission();
  await prisma.operatingCompany.create({
    data: {
      companyName: data.companyName as string,
      registrationNumber: (data.registrationNumber as string) || null,
      postalCode: (data.postalCode as string) || null,
      address: (data.address as string) || null,
      address2: (data.address2 as string) || null,
      representativeName: (data.representativeName as string) || null,
      phone: (data.phone as string) || null,
      abbreviation: (data.abbreviation as string) || null,
      invoicePrefix: (data.invoicePrefix as string) || null,
      paymentMonthOffset: data.paymentMonthOffset != null && data.paymentMonthOffset !== ""
        ? Number(data.paymentMonthOffset)
        : null,
      paymentDay: data.paymentDay != null && data.paymentDay !== ""
        ? Number(data.paymentDay)
        : null,
      cloudsignClientId: (data.cloudsignClientId as string) || null,
    },
  });
  revalidatePath("/settings/operating-companies");
  revalidatePath("/settings/projects");
}

export async function updateOperatingCompany(
  id: number,
  data: Record<string, unknown>
) {
  await requireMasterDataEditPermission();
  const updateData: Record<string, unknown> = {};
  if ("companyName" in data) updateData.companyName = data.companyName as string;
  if ("registrationNumber" in data) updateData.registrationNumber = (data.registrationNumber as string) || null;
  if ("postalCode" in data) updateData.postalCode = (data.postalCode as string) || null;
  if ("address" in data) updateData.address = (data.address as string) || null;
  if ("address2" in data) updateData.address2 = (data.address2 as string) || null;
  if ("representativeName" in data) updateData.representativeName = (data.representativeName as string) || null;
  if ("phone" in data) updateData.phone = (data.phone as string) || null;
  if ("abbreviation" in data) updateData.abbreviation = (data.abbreviation as string) || null;
  if ("invoicePrefix" in data) updateData.invoicePrefix = (data.invoicePrefix as string) || null;
  if ("cloudsignClientId" in data) {
    const val = data.cloudsignClientId as string;
    // マスク値("********")は変更なしとして無視し、空文字はクリア、それ以外は新しい値として保存
    if (val !== "********") {
      updateData.cloudsignClientId = val || null;
    }
  }
  if ("paymentMonthOffset" in data) updateData.paymentMonthOffset = data.paymentMonthOffset != null && data.paymentMonthOffset !== ""
    ? Number(data.paymentMonthOffset)
    : null;
  if ("paymentDay" in data) updateData.paymentDay = data.paymentDay != null && data.paymentDay !== ""
    ? Number(data.paymentDay)
    : null;
  if ("logoPath" in data) updateData.logoPath = (data.logoPath as string) || null;

  if (Object.keys(updateData).length > 0) {
    await prisma.operatingCompany.update({
      where: { id },
      data: updateData,
    });
  }
  revalidatePath("/settings/operating-companies");
  revalidatePath("/settings/projects");
}

export async function deleteOperatingCompany(id: number) {
  await requireMasterDataEditPermission();
  await prisma.operatingCompany.update({
    where: { id },
    data: { isActive: false },
  });
  revalidatePath("/settings/operating-companies");
  revalidatePath("/settings/projects");
}
