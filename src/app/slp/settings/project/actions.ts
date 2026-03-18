"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireProjectMasterDataEditPermission } from "@/lib/auth/master-data-permission";

// プロジェクト基本情報更新
export async function updateProjectBasicInfo(
  projectId: number,
  data: { name?: string; description?: string }
) {
  await requireProjectMasterDataEditPermission("slp");

  const updateData: Record<string, unknown> = {};
  if (data.name !== undefined) updateData.name = data.name.trim();
  if (data.description !== undefined)
    updateData.description = data.description.trim() || null;

  if (Object.keys(updateData).length > 0) {
    await prisma.masterProject.update({
      where: { id: projectId },
      data: updateData,
    });
  }

  revalidatePath("/slp/settings/project");
}

// 運営法人情報更新
export async function updateOperatingCompanyInfo(
  companyId: number,
  data: {
    companyName?: string;
    postalCode?: string;
    address?: string;
    address2?: string;
    representativeName?: string;
    phone?: string;
    registrationNumber?: string;
  }
) {
  await requireProjectMasterDataEditPermission("slp");

  const updateData: Record<string, unknown> = {};
  if (data.companyName !== undefined)
    updateData.companyName = data.companyName.trim();
  if (data.postalCode !== undefined)
    updateData.postalCode = data.postalCode.trim() || null;
  if (data.address !== undefined)
    updateData.address = data.address.trim() || null;
  if (data.address2 !== undefined)
    updateData.address2 = data.address2.trim() || null;
  if (data.representativeName !== undefined)
    updateData.representativeName = data.representativeName.trim() || null;
  if (data.phone !== undefined)
    updateData.phone = data.phone.trim() || null;
  if (data.registrationNumber !== undefined)
    updateData.registrationNumber = data.registrationNumber.trim() || null;

  if (Object.keys(updateData).length > 0) {
    await prisma.operatingCompany.update({
      where: { id: companyId },
      data: updateData,
    });
  }

  revalidatePath("/slp/settings/project");
}

// 入会フォーム用契約種別の更新
export async function updateMemberContractType(
  projectId: number,
  contractTypeId: number | null
) {
  await requireProjectMasterDataEditPermission("slp");

  await prisma.masterProject.update({
    where: { id: projectId },
    data: { slpMemberContractTypeId: contractTypeId },
  });

  revalidatePath("/slp/settings/project");
}
