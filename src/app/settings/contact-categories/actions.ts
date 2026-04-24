"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireProjectMasterDataEditPermission } from "@/lib/auth/master-data-permission";
import { toBoolean } from "@/lib/utils";
import { ok, err, type ActionResult } from "@/lib/action-result";

export async function addContactCategory(
  data: Record<string, unknown>
): Promise<ActionResult> {
  try {
    await requireProjectMasterDataEditPermission();
    const projectId = Number(data.projectId);

    // 同プロジェクト内の最大表示順を取得して+1
    const maxOrder = await prisma.contactCategory.aggregate({
      where: { projectId },
      _max: { displayOrder: true },
    });
    const displayOrder = (maxOrder._max.displayOrder ?? 0) + 1;

    await prisma.contactCategory.create({
      data: {
        projectId,
        name: data.name as string,
        displayOrder,
        isActive: toBoolean(data.isActive),
      },
    });
    revalidatePath("/settings/contact-categories");
    return ok();
  } catch (e) {
    console.error("[addContactCategory] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
}

export async function updateContactCategory(
  id: number,
  data: Record<string, unknown>
): Promise<ActionResult> {
  try {
    await requireProjectMasterDataEditPermission();
    const updateData: Record<string, unknown> = {};
    if ("projectId" in data) updateData.projectId = Number(data.projectId);
    if ("name" in data) updateData.name = data.name as string;
    if ("isActive" in data) updateData.isActive = toBoolean(data.isActive);

    if (Object.keys(updateData).length > 0) {
      await prisma.contactCategory.update({
        where: { id },
        data: updateData,
      });
    }
    revalidatePath("/settings/contact-categories");
    return ok();
  } catch (e) {
    console.error("[updateContactCategory] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
}

export async function deleteContactCategory(id: number): Promise<ActionResult> {
  try {
    await requireProjectMasterDataEditPermission();

    // 接触履歴で使用中の場合はエラー (V2)
    const usageCount = await prisma.contactHistoryV2.count({
      where: { contactCategoryId: id, deletedAt: null },
    });
    if (usageCount > 0) {
      return err(
        `この接触種別は ${usageCount} 件の接触履歴で使用されているため削除できません`
      );
    }

    await prisma.contactCategory.delete({
      where: { id },
    });
    revalidatePath("/settings/contact-categories");
    return ok();
  } catch (e) {
    console.error("[deleteContactCategory] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
}

export async function reorderContactCategories(
  orderedIds: number[]
): Promise<ActionResult> {
  try {
    await requireProjectMasterDataEditPermission();

    // まず全ての接触種別を取得してプロジェクト別にグループ化
    const contactCategories = await prisma.contactCategory.findMany({
      where: { id: { in: orderedIds } },
      select: { id: true, projectId: true },
    });

    const idToProjectId = new Map(contactCategories.map((cc) => [cc.id, cc.projectId]));

    // プロジェクトごとにカウンターを管理
    const projectCounters = new Map<number, number>();

    await prisma.$transaction(
      orderedIds.map((id) => {
        const projectId = idToProjectId.get(id)!;
        const currentOrder = (projectCounters.get(projectId) ?? 0) + 1;
        projectCounters.set(projectId, currentOrder);

        return prisma.contactCategory.update({
          where: { id },
          data: { displayOrder: currentOrder },
        });
      })
    );

    revalidatePath("/settings/contact-categories");
    return ok();
  } catch (e) {
    console.error("[reorderContactCategories] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
}
