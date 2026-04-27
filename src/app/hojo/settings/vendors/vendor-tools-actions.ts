"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireProjectMasterDataEditPermission } from "@/lib/auth/master-data-permission";
import { toBoolean } from "@/lib/utils";
import { ok, err, type ActionResult } from "@/lib/action-result";

// ============================================
// ツールマスタ
// ============================================

export async function getAllTools() {
  const tools = await prisma.hojoVendorTool.findMany({
    orderBy: { displayOrder: "asc" },
  });
  return tools.map((t) => ({
    id: t.id,
    name: t.name,
    displayOrder: t.displayOrder,
    isActive: t.isActive,
  }));
}

export async function getActiveToolsWithStatuses() {
  const tools = await prisma.hojoVendorTool.findMany({
    where: { isActive: true },
    include: {
      statuses: {
        where: { isActive: true },
        orderBy: { displayOrder: "asc" },
      },
    },
    orderBy: { displayOrder: "asc" },
  });
  return tools.map((t) => ({
    id: t.id,
    name: t.name,
    displayOrder: t.displayOrder,
    isActive: t.isActive,
    statuses: t.statuses.map((s) => ({
      id: s.id,
      name: s.name,
      displayOrder: s.displayOrder,
      isActive: s.isActive,
      isCompleted: s.isCompleted,
    })),
  }));
}

export async function addTool(data: Record<string, unknown>): Promise<ActionResult> {
  try {
    await requireProjectMasterDataEditPermission();
    const name = String(data.name ?? "").trim();
    if (!name) return err("ツール名を入力してください");

    const maxOrder = await prisma.hojoVendorTool.aggregate({
      _max: { displayOrder: true },
    });
    await prisma.hojoVendorTool.create({
      data: {
        name,
        displayOrder: (maxOrder._max.displayOrder ?? 0) + 1,
        isActive: data.isActive === undefined ? true : toBoolean(data.isActive),
      },
    });
    revalidatePath("/hojo/settings/vendors");
    return ok();
  } catch (e) {
    console.error("[addTool] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
}

export async function updateTool(id: number, data: Record<string, unknown>): Promise<ActionResult> {
  try {
    await requireProjectMasterDataEditPermission();
    await prisma.hojoVendorTool.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: String(data.name).trim() }),
        ...(data.isActive !== undefined && { isActive: toBoolean(data.isActive) }),
      },
    });
    revalidatePath("/hojo/settings/vendors");
    return ok();
  } catch (e) {
    console.error("[updateTool] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
}

export async function deleteTool(id: number): Promise<ActionResult> {
  try {
    await requireProjectMasterDataEditPermission();
    // FK は CASCADE 設定（statuses, registrations は連鎖削除）
    await prisma.hojoVendorTool.delete({ where: { id } });
    revalidatePath("/hojo/settings/vendors");
    return ok();
  } catch (e) {
    console.error("[deleteTool] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
}

export async function reorderTools(orderedIds: number[]): Promise<ActionResult> {
  try {
    await requireProjectMasterDataEditPermission();
    await prisma.$transaction(
      orderedIds.map((id, index) =>
        prisma.hojoVendorTool.update({
          where: { id },
          data: { displayOrder: index + 1 },
        })
      )
    );
    revalidatePath("/hojo/settings/vendors");
    return ok();
  } catch (e) {
    console.error("[reorderTools] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
}

// ============================================
// ツール毎のステータスマスタ
// ============================================

export async function getToolStatuses(toolId: number) {
  const statuses = await prisma.hojoVendorToolStatus.findMany({
    where: { toolId },
    orderBy: { displayOrder: "asc" },
  });
  return statuses.map((s) => ({
    id: s.id,
    toolId: s.toolId,
    name: s.name,
    displayOrder: s.displayOrder,
    isActive: s.isActive,
    isCompleted: s.isCompleted,
  }));
}

export async function addToolStatus(
  toolId: number,
  data: Record<string, unknown>
): Promise<ActionResult> {
  try {
    await requireProjectMasterDataEditPermission();
    const name = String(data.name ?? "").trim();
    if (!name) return err("ステータス名を入力してください");

    const maxOrder = await prisma.hojoVendorToolStatus.aggregate({
      where: { toolId },
      _max: { displayOrder: true },
    });
    await prisma.hojoVendorToolStatus.create({
      data: {
        toolId,
        name,
        displayOrder: (maxOrder._max.displayOrder ?? 0) + 1,
        isActive: data.isActive === undefined ? true : toBoolean(data.isActive),
        isCompleted: toBoolean(data.isCompleted),
      },
    });
    revalidatePath("/hojo/settings/vendors");
    return ok();
  } catch (e) {
    console.error("[addToolStatus] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
}

export async function updateToolStatus(
  id: number,
  data: Record<string, unknown>
): Promise<ActionResult> {
  try {
    await requireProjectMasterDataEditPermission();
    await prisma.hojoVendorToolStatus.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: String(data.name).trim() }),
        ...(data.isActive !== undefined && { isActive: toBoolean(data.isActive) }),
        ...("isCompleted" in data && { isCompleted: toBoolean(data.isCompleted) }),
      },
    });
    revalidatePath("/hojo/settings/vendors");
    return ok();
  } catch (e) {
    console.error("[updateToolStatus] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
}

export async function deleteToolStatus(id: number): Promise<ActionResult> {
  try {
    await requireProjectMasterDataEditPermission();
    const usageCount = await prisma.hojoVendorToolRegistration.count({
      where: { statusId: id },
    });
    if (usageCount > 0) {
      return err(`このステータスは${usageCount}件のベンダーで使用中のため削除できません`);
    }
    await prisma.hojoVendorToolStatus.delete({ where: { id } });
    revalidatePath("/hojo/settings/vendors");
    return ok();
  } catch (e) {
    console.error("[deleteToolStatus] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
}

export async function reorderToolStatuses(
  toolId: number,
  orderedIds: number[]
): Promise<ActionResult> {
  try {
    await requireProjectMasterDataEditPermission();
    await prisma.$transaction(
      orderedIds.map((id, index) =>
        prisma.hojoVendorToolStatus.update({
          where: { id },
          data: { displayOrder: index + 1 },
        })
      )
    );
    revalidatePath("/hojo/settings/vendors");
    void toolId; // 引数は呼び出し側の整合性のため受け取るが、id は status 個別更新で十分
    return ok();
  } catch (e) {
    console.error("[reorderToolStatuses] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
}

// ============================================
// ベンダーのツール登録（vendor x tool）
// ============================================

type ToolRegistrationInput = {
  toolId: number;
  statusId?: number | null;
  memo?: string | null;
};

export async function saveVendorToolRegistrations(
  vendorId: number,
  items: ToolRegistrationInput[]
): Promise<ActionResult> {
  try {
    await requireProjectMasterDataEditPermission();
    if (!Number.isFinite(vendorId)) return err("無効なベンダーIDです");

    await prisma.$transaction(
      items.map((item) => {
        const memo = item.memo?.trim() || null;
        const statusId = item.statusId ?? null;
        return prisma.hojoVendorToolRegistration.upsert({
          where: { vendorId_toolId: { vendorId, toolId: item.toolId } },
          create: { vendorId, toolId: item.toolId, statusId, memo },
          update: { statusId, memo },
        });
      })
    );
    revalidatePath(`/hojo/settings/vendors/${vendorId}`);
    revalidatePath("/hojo/settings/vendors");
    return ok();
  } catch (e) {
    console.error("[saveVendorToolRegistrations] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
}
