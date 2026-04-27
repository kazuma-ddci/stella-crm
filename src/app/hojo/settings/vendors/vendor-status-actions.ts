"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireProjectMasterDataEditPermission } from "@/lib/auth/master-data-permission";
import { toBoolean } from "@/lib/utils";
import { ok, err, type ActionResult } from "@/lib/action-result";

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
    color: s.color,
  }));
}

export async function addScWholesaleStatus(data: Record<string, unknown>): Promise<ActionResult> {
  try {
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
        ...(typeof data.color === "string" && data.color && { color: data.color }),
      },
    });
    revalidatePath("/hojo/settings/vendors");
    return ok();
  } catch (e) {
    console.error("[addScWholesaleStatus] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
}

export async function updateScWholesaleStatus(id: number, data: Record<string, unknown>): Promise<ActionResult> {
  try {
    await requireProjectMasterDataEditPermission();
    const updateData: Record<string, unknown> = {};
    if ("name" in data) updateData.name = String(data.name).trim();
    if ("isActive" in data) updateData.isActive = toBoolean(data.isActive);
    if ("color" in data && typeof data.color === "string" && data.color) updateData.color = data.color;

    if (Object.keys(updateData).length > 0) {
      await prisma.hojoVendorScWholesaleStatus.update({
        where: { id },
        data: updateData,
      });
    }
    revalidatePath("/hojo/settings/vendors");
    return ok();
  } catch (e) {
    console.error("[updateScWholesaleStatus] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
}

export async function deleteScWholesaleStatus(id: number): Promise<ActionResult> {
  try {
    await requireProjectMasterDataEditPermission();

    const usageCount = await prisma.hojoVendor.count({
      where: { scWholesaleStatusId: id },
    });
    if (usageCount > 0) {
      return err(`このステータスは${usageCount}件のベンダーで使用中のため削除できません`);
    }

    await prisma.hojoVendorScWholesaleStatus.delete({
      where: { id },
    });
    revalidatePath("/hojo/settings/vendors");
    return ok();
  } catch (e) {
    console.error("[deleteScWholesaleStatus] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
}

export async function reorderScWholesaleStatuses(orderedIds: number[]): Promise<ActionResult> {
  try {
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
    return ok();
  } catch (e) {
    console.error("[reorderScWholesaleStatuses] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
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
    color: s.color,
  }));
}

export async function addConsultingPlanStatus(data: Record<string, unknown>): Promise<ActionResult> {
  try {
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
        ...(typeof data.color === "string" && data.color && { color: data.color }),
      },
    });
    revalidatePath("/hojo/settings/vendors");
    return ok();
  } catch (e) {
    console.error("[addConsultingPlanStatus] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
}

export async function updateConsultingPlanStatus(id: number, data: Record<string, unknown>): Promise<ActionResult> {
  try {
    await requireProjectMasterDataEditPermission();
    const updateData: Record<string, unknown> = {};
    if ("name" in data) updateData.name = String(data.name).trim();
    if ("isActive" in data) updateData.isActive = toBoolean(data.isActive);
    if ("color" in data && typeof data.color === "string" && data.color) updateData.color = data.color;

    if (Object.keys(updateData).length > 0) {
      await prisma.hojoVendorConsultingPlanStatus.update({
        where: { id },
        data: updateData,
      });
    }
    revalidatePath("/hojo/settings/vendors");
    return ok();
  } catch (e) {
    console.error("[updateConsultingPlanStatus] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
}

export async function deleteConsultingPlanStatus(id: number): Promise<ActionResult> {
  try {
    await requireProjectMasterDataEditPermission();

    const usageCount = await prisma.hojoVendor.count({
      where: { consultingPlanStatusId: id },
    });
    if (usageCount > 0) {
      return err(`このステータスは${usageCount}件のベンダーで使用中のため削除できません`);
    }

    await prisma.hojoVendorConsultingPlanStatus.delete({
      where: { id },
    });
    revalidatePath("/hojo/settings/vendors");
    return ok();
  } catch (e) {
    console.error("[deleteConsultingPlanStatus] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
}

export async function reorderConsultingPlanStatuses(orderedIds: number[]): Promise<ActionResult> {
  try {
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
    return ok();
  } catch (e) {
    console.error("[reorderConsultingPlanStatuses] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
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
    isCompleted: s.isCompleted,
  }));
}

export async function addVendorRegistrationStatus(data: Record<string, unknown>): Promise<ActionResult> {
  try {
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
        ...("isCompleted" in data && { isCompleted: toBoolean(data.isCompleted) }),
      },
    });
    revalidatePath("/hojo/settings/vendors");
    return ok();
  } catch (e) {
    console.error("[addVendorRegistrationStatus] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
}

export async function updateVendorRegistrationStatus(id: number, data: Record<string, unknown>): Promise<ActionResult> {
  try {
    await requireProjectMasterDataEditPermission();
    const updateData: Record<string, unknown> = {};
    if ("name" in data) updateData.name = String(data.name).trim();
    if ("isActive" in data) updateData.isActive = toBoolean(data.isActive);
    if ("isCompleted" in data) updateData.isCompleted = toBoolean(data.isCompleted);

    if (Object.keys(updateData).length > 0) {
      await prisma.hojoVendorRegistrationStatus.update({
        where: { id },
        data: updateData,
      });
    }
    revalidatePath("/hojo/settings/vendors");
    return ok();
  } catch (e) {
    console.error("[updateVendorRegistrationStatus] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
}

export async function deleteVendorRegistrationStatus(id: number): Promise<ActionResult> {
  try {
    await requireProjectMasterDataEditPermission();

    const usageCount = await prisma.hojoVendor.count({
      where: { vendorRegistrationStatusId: id },
    });
    if (usageCount > 0) {
      return err(`このステータスは${usageCount}件のベンダーで使用中のため削除できません`);
    }

    await prisma.hojoVendorRegistrationStatus.delete({
      where: { id },
    });
    revalidatePath("/hojo/settings/vendors");
    return ok();
  } catch (e) {
    console.error("[deleteVendorRegistrationStatus] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
}

export async function reorderVendorRegistrationStatuses(orderedIds: number[]): Promise<ActionResult> {
  try {
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
    return ok();
  } catch (e) {
    console.error("[reorderVendorRegistrationStatuses] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
}

// ============================================
// 契約状況マスタ管理（共通: セキュリティクラウド卸/コンサル/BPOで共通利用）
// ============================================

export async function getAllContractStatuses() {
  const statuses = await prisma.hojoVendorContractStatus.findMany({
    orderBy: { displayOrder: "asc" },
  });
  return statuses.map((s) => ({
    id: s.id,
    name: s.name,
    displayOrder: s.displayOrder,
    isActive: s.isActive,
    isCompleted: s.isCompleted,
  }));
}

export async function addContractStatus(data: Record<string, unknown>): Promise<ActionResult> {
  try {
    await requireProjectMasterDataEditPermission();

    const maxOrder = await prisma.hojoVendorContractStatus.aggregate({
      _max: { displayOrder: true },
    });
    const displayOrder = (maxOrder._max.displayOrder ?? 0) + 1;

    await prisma.hojoVendorContractStatus.create({
      data: {
        name: String(data.name).trim(),
        displayOrder,
        isActive: toBoolean(data.isActive),
        ...("isCompleted" in data && { isCompleted: toBoolean(data.isCompleted) }),
      },
    });
    revalidatePath("/hojo/settings/vendors");
    return ok();
  } catch (e) {
    console.error("[addContractStatus] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
}

export async function updateContractStatus(id: number, data: Record<string, unknown>): Promise<ActionResult> {
  try {
    await requireProjectMasterDataEditPermission();
    const updateData: Record<string, unknown> = {};
    if ("name" in data) updateData.name = String(data.name).trim();
    if ("isActive" in data) updateData.isActive = toBoolean(data.isActive);
    if ("isCompleted" in data) updateData.isCompleted = toBoolean(data.isCompleted);

    if (Object.keys(updateData).length > 0) {
      await prisma.hojoVendorContractStatus.update({
        where: { id },
        data: updateData,
      });
    }
    revalidatePath("/hojo/settings/vendors");
    return ok();
  } catch (e) {
    console.error("[updateContractStatus] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
}

export async function deleteContractStatus(id: number): Promise<ActionResult> {
  try {
    await requireProjectMasterDataEditPermission();

    const usageCount = await prisma.hojoVendor.count({
      where: {
        OR: [
          { scWholesaleContractStatusId: id },
          { consultingPlanContractStatusId: id },
          { grantApplicationBpoContractStatusId: id },
        ],
      },
    });
    if (usageCount > 0) {
      return err(`このステータスは${usageCount}件のベンダーで使用中のため削除できません`);
    }

    await prisma.hojoVendorContractStatus.delete({
      where: { id },
    });
    revalidatePath("/hojo/settings/vendors");
    return ok();
  } catch (e) {
    console.error("[deleteContractStatus] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
}

export async function reorderContractStatuses(orderedIds: number[]): Promise<ActionResult> {
  try {
    await requireProjectMasterDataEditPermission();
    await prisma.$transaction(
      orderedIds.map((id, index) =>
        prisma.hojoVendorContractStatus.update({
          where: { id },
          data: { displayOrder: index + 1 },
        })
      )
    );
    revalidatePath("/hojo/settings/vendors");
    return ok();
  } catch (e) {
    console.error("[reorderContractStatuses] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
}
