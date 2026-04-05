"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireProjectMasterDataEditPermission } from "@/lib/auth/master-data-permission";
import { toBoolean } from "@/lib/utils";

// ============================================
// セキュリティクラウド卸ステータス管理
// ============================================

export async function getAllScWholesaleStatuses() {
  const statuses = await prisma.hojoVendorScWholesaleStatus.findMany({
    orderBy: { displayOrder: "asc" },
  });
  return statuses.map((s) => ({
    id: s.id,
    name: s.name,
    displayOrder: s.displayOrder,
    isActive: s.isActive,
  }));
}

export async function addScWholesaleStatus(data: Record<string, unknown>) {
  await requireProjectMasterDataEditPermission();

  const maxOrder = await prisma.hojoVendorScWholesaleStatus.aggregate({
    _max: { displayOrder: true },
  });
  const displayOrder = (maxOrder._max.displayOrder ?? 0) + 1;

  await prisma.hojoVendorScWholesaleStatus.create({
    data: {
      name: String(data.name).trim(),
      displayOrder,
      isActive: toBoolean(data.isActive),
    },
  });
  revalidatePath("/hojo/settings/vendors");
}

export async function updateScWholesaleStatus(id: number, data: Record<string, unknown>) {
  await requireProjectMasterDataEditPermission();
  const updateData: Record<string, unknown> = {};
  if ("name" in data) updateData.name = String(data.name).trim();
  if ("isActive" in data) updateData.isActive = toBoolean(data.isActive);

  if (Object.keys(updateData).length > 0) {
    await prisma.hojoVendorScWholesaleStatus.update({
      where: { id },
      data: updateData,
    });
  }
  revalidatePath("/hojo/settings/vendors");
}

export async function deleteScWholesaleStatus(id: number) {
  await requireProjectMasterDataEditPermission();

  const usageCount = await prisma.hojoVendor.count({
    where: { scWholesaleStatusId: id },
  });
  if (usageCount > 0) {
    throw new Error(`このステータスは${usageCount}件のベンダーで使用中のため削除できません`);
  }

  await prisma.hojoVendorScWholesaleStatus.delete({
    where: { id },
  });
  revalidatePath("/hojo/settings/vendors");
}

export async function reorderScWholesaleStatuses(orderedIds: number[]) {
  await requireProjectMasterDataEditPermission();
  await prisma.$transaction(
    orderedIds.map((id, index) =>
      prisma.hojoVendorScWholesaleStatus.update({
        where: { id },
        data: { displayOrder: index + 1 },
      })
    )
  );
  revalidatePath("/hojo/settings/vendors");
}

// ============================================
// コンサルティングプランステータス管理
// ============================================

export async function getAllConsultingPlanStatuses() {
  const statuses = await prisma.hojoVendorConsultingPlanStatus.findMany({
    orderBy: { displayOrder: "asc" },
  });
  return statuses.map((s) => ({
    id: s.id,
    name: s.name,
    displayOrder: s.displayOrder,
    isActive: s.isActive,
  }));
}

export async function addConsultingPlanStatus(data: Record<string, unknown>) {
  await requireProjectMasterDataEditPermission();

  const maxOrder = await prisma.hojoVendorConsultingPlanStatus.aggregate({
    _max: { displayOrder: true },
  });
  const displayOrder = (maxOrder._max.displayOrder ?? 0) + 1;

  await prisma.hojoVendorConsultingPlanStatus.create({
    data: {
      name: String(data.name).trim(),
      displayOrder,
      isActive: toBoolean(data.isActive),
    },
  });
  revalidatePath("/hojo/settings/vendors");
}

export async function updateConsultingPlanStatus(id: number, data: Record<string, unknown>) {
  await requireProjectMasterDataEditPermission();
  const updateData: Record<string, unknown> = {};
  if ("name" in data) updateData.name = String(data.name).trim();
  if ("isActive" in data) updateData.isActive = toBoolean(data.isActive);

  if (Object.keys(updateData).length > 0) {
    await prisma.hojoVendorConsultingPlanStatus.update({
      where: { id },
      data: updateData,
    });
  }
  revalidatePath("/hojo/settings/vendors");
}

export async function deleteConsultingPlanStatus(id: number) {
  await requireProjectMasterDataEditPermission();

  const usageCount = await prisma.hojoVendor.count({
    where: { consultingPlanStatusId: id },
  });
  if (usageCount > 0) {
    throw new Error(`このステータスは${usageCount}件のベンダーで使用中のため削除できません`);
  }

  await prisma.hojoVendorConsultingPlanStatus.delete({
    where: { id },
  });
  revalidatePath("/hojo/settings/vendors");
}

export async function reorderConsultingPlanStatuses(orderedIds: number[]) {
  await requireProjectMasterDataEditPermission();
  await prisma.$transaction(
    orderedIds.map((id, index) =>
      prisma.hojoVendorConsultingPlanStatus.update({
        where: { id },
        data: { displayOrder: index + 1 },
      })
    )
  );
  revalidatePath("/hojo/settings/vendors");
}

// ============================================
// ベンダー登録ステータス管理
// ============================================

export async function getAllVendorRegistrationStatuses() {
  const statuses = await prisma.hojoVendorRegistrationStatus.findMany({
    orderBy: { displayOrder: "asc" },
  });
  return statuses.map((s) => ({
    id: s.id,
    name: s.name,
    displayOrder: s.displayOrder,
    isActive: s.isActive,
  }));
}

export async function addVendorRegistrationStatus(data: Record<string, unknown>) {
  await requireProjectMasterDataEditPermission();

  const maxOrder = await prisma.hojoVendorRegistrationStatus.aggregate({
    _max: { displayOrder: true },
  });
  const displayOrder = (maxOrder._max.displayOrder ?? 0) + 1;

  await prisma.hojoVendorRegistrationStatus.create({
    data: {
      name: String(data.name).trim(),
      displayOrder,
      isActive: toBoolean(data.isActive),
    },
  });
  revalidatePath("/hojo/settings/vendors");
}

export async function updateVendorRegistrationStatus(id: number, data: Record<string, unknown>) {
  await requireProjectMasterDataEditPermission();
  const updateData: Record<string, unknown> = {};
  if ("name" in data) updateData.name = String(data.name).trim();
  if ("isActive" in data) updateData.isActive = toBoolean(data.isActive);

  if (Object.keys(updateData).length > 0) {
    await prisma.hojoVendorRegistrationStatus.update({
      where: { id },
      data: updateData,
    });
  }
  revalidatePath("/hojo/settings/vendors");
}

export async function deleteVendorRegistrationStatus(id: number) {
  await requireProjectMasterDataEditPermission();

  const usageCount = await prisma.hojoVendor.count({
    where: { vendorRegistrationStatusId: id },
  });
  if (usageCount > 0) {
    throw new Error(`このステータスは${usageCount}件のベンダーで使用中のため削除できません`);
  }

  await prisma.hojoVendorRegistrationStatus.delete({
    where: { id },
  });
  revalidatePath("/hojo/settings/vendors");
}

export async function reorderVendorRegistrationStatuses(orderedIds: number[]) {
  await requireProjectMasterDataEditPermission();
  await prisma.$transaction(
    orderedIds.map((id, index) =>
      prisma.hojoVendorRegistrationStatus.update({
        where: { id },
        data: { displayOrder: index + 1 },
      })
    )
  );
  revalidatePath("/hojo/settings/vendors");
}

// ============================================
// ツール登録の有無
// ============================================

export async function getAllToolRegistrationStatuses() {
  return prisma.hojoVendorToolRegistrationStatus.findMany({
    orderBy: { displayOrder: "asc" },
  });
}

export async function addToolRegistrationStatus(data: Record<string, unknown>) {
  await requireProjectMasterDataEditPermission();
  const maxOrder = await prisma.hojoVendorToolRegistrationStatus.aggregate({ _max: { displayOrder: true } });
  await prisma.hojoVendorToolRegistrationStatus.create({
    data: {
      name: String(data.name),
      isActive: data.isActive !== false,
      displayOrder: (maxOrder._max.displayOrder ?? 0) + 1,
    },
  });
  revalidatePath("/hojo/settings/vendors");
}

export async function updateToolRegistrationStatus(id: number, data: Record<string, unknown>) {
  await requireProjectMasterDataEditPermission();
  await prisma.hojoVendorToolRegistrationStatus.update({
    where: { id },
    data: {
      ...(data.name !== undefined && { name: String(data.name) }),
      ...(data.isActive !== undefined && { isActive: Boolean(data.isActive) }),
    },
  });
  revalidatePath("/hojo/settings/vendors");
}

export async function deleteToolRegistrationStatus(id: number) {
  await requireProjectMasterDataEditPermission();
  const usageCount = await prisma.hojoVendor.count({
    where: { toolRegistrationStatusId: id },
  });
  if (usageCount > 0) {
    throw new Error(`このステータスは${usageCount}件のベンダーで使用中のため削除できません`);
  }
  await prisma.hojoVendorToolRegistrationStatus.delete({
    where: { id },
  });
  revalidatePath("/hojo/settings/vendors");
}

export async function reorderToolRegistrationStatuses(orderedIds: number[]) {
  await requireProjectMasterDataEditPermission();
  await prisma.$transaction(
    orderedIds.map((id, index) =>
      prisma.hojoVendorToolRegistrationStatus.update({
        where: { id },
        data: { displayOrder: index + 1 },
      })
    )
  );
  revalidatePath("/hojo/settings/vendors");
}

// ============================================
// 案件ステータス管理
// ============================================

export async function getAllCaseStatuses() {
  const statuses = await prisma.hojoVendorCaseStatus.findMany({
    orderBy: { displayOrder: "asc" },
  });
  return statuses.map((s) => ({
    id: s.id,
    name: s.name,
    displayOrder: s.displayOrder,
    isActive: s.isActive,
  }));
}

export async function addCaseStatus(data: Record<string, unknown>) {
  await requireProjectMasterDataEditPermission();

  const maxOrder = await prisma.hojoVendorCaseStatus.aggregate({
    _max: { displayOrder: true },
  });
  const displayOrder = (maxOrder._max.displayOrder ?? 0) + 1;

  await prisma.hojoVendorCaseStatus.create({
    data: {
      name: String(data.name).trim(),
      displayOrder,
      isActive: toBoolean(data.isActive),
    },
  });
  revalidatePath("/hojo/settings/vendors");
}

export async function updateCaseStatus(id: number, data: Record<string, unknown>) {
  await requireProjectMasterDataEditPermission();
  const updateData: Record<string, unknown> = {};
  if ("name" in data) updateData.name = String(data.name).trim();
  if ("isActive" in data) updateData.isActive = toBoolean(data.isActive);

  if (Object.keys(updateData).length > 0) {
    await prisma.hojoVendorCaseStatus.update({
      where: { id },
      data: updateData,
    });
  }
  revalidatePath("/hojo/settings/vendors");
}

export async function deleteCaseStatus(id: number) {
  await requireProjectMasterDataEditPermission();

  const usageCount = await prisma.hojoVendor.count({
    where: { caseStatusId: id },
  });
  if (usageCount > 0) {
    throw new Error(`このステータスは${usageCount}件のベンダーで使用中のため削除できません`);
  }

  await prisma.hojoVendorCaseStatus.delete({
    where: { id },
  });
  revalidatePath("/hojo/settings/vendors");
}

export async function reorderCaseStatuses(orderedIds: number[]) {
  await requireProjectMasterDataEditPermission();
  await prisma.$transaction(
    orderedIds.map((id, index) =>
      prisma.hojoVendorCaseStatus.update({
        where: { id },
        data: { displayOrder: index + 1 },
      })
    )
  );
  revalidatePath("/hojo/settings/vendors");
}
