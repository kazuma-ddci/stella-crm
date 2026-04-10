"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireProjectMasterDataEditPermission } from "@/lib/auth/master-data-permission";

// プロジェクト基本情報更新
export async function updateProjectBasicInfo(
  projectId: number,
  data: { name?: string; description?: string; defaultApproverStaffId?: number | null }
) {
  await requireProjectMasterDataEditPermission("slp");

  const updateData: Record<string, unknown> = {};
  if (data.name !== undefined) updateData.name = data.name.trim();
  if (data.description !== undefined)
    updateData.description = data.description.trim() || null;
  if (data.defaultApproverStaffId !== undefined) {
    if (data.defaultApproverStaffId) {
      updateData.defaultApprover = { connect: { id: data.defaultApproverStaffId } };
    } else {
      updateData.defaultApprover = { disconnect: true };
    }
  }

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

// 契約書自動送付ON/OFF更新
export async function updateAutoSendContract(
  projectId: number,
  enabled: boolean
) {
  await requireProjectMasterDataEditPermission("slp");

  await prisma.masterProject.update({
    where: { id: projectId },
    data: { autoSendContract: enabled },
  });

  revalidatePath("/slp/settings/project");
  revalidatePath("/slp/members");
}

// LINE後紐付け時のForm5自動送信ON/OFF更新
export async function updateSlpForm5AutoSendOnLink(
  projectId: number,
  enabled: boolean
) {
  await requireProjectMasterDataEditPermission("slp");

  await prisma.masterProject.update({
    where: { id: projectId },
    data: { slpForm5AutoSendOnLink: enabled },
  });

  revalidatePath("/slp/settings/project");
}

// 入会フォーム回答後の自動送付契約書（CloudSignテンプレート）の更新
export async function updateMemberCloudSignTemplate(
  projectId: number,
  templateId: number | null
) {
  await requireProjectMasterDataEditPermission("slp");

  await prisma.masterProject.update({
    where: { id: projectId },
    data: { slpMemberCloudSignTemplateId: templateId },
  });

  revalidatePath("/slp/settings/project");
}
