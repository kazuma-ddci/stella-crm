"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { toBoolean } from "@/lib/utils";
import { ok, err, type ActionResult } from "@/lib/action-result";

const VALID_TYPES = ["revenue", "expense", "both"] as const;

export async function createExpenseCategory(
  data: Record<string, unknown>
): Promise<ActionResult> {
  try {
    const session = await getSession();
    const staffId = session.id;

    const name = (data.name as string).trim();
    const type = data.type as string;
    const projectId = data.projectId ? Number(data.projectId) : null;
    if (!projectId) {
      return err("プロジェクトは必須です");
    }
    const defaultAccountId = data.defaultAccountId
      ? Number(data.defaultAccountId)
      : null;
    const displayOrder = data.displayOrder ? Number(data.displayOrder) : 0;
    const isActive = data.isActive !== false && data.isActive !== "false";

    if (!name || !type) {
      return err("名称と種別は必須です");
    }

    if (!(VALID_TYPES as readonly string[]).includes(type)) {
      return err("無効な種別です");
    }

    // 名称重複チェック（同一プロジェクト内）
    const existing = await prisma.expenseCategory.findFirst({
      where: { name, deletedAt: null, projectId },
      select: { id: true },
    });
    if (existing) {
      return err(`費目「${name}」は既に登録されています`);
    }

    await prisma.expenseCategory.create({
      data: {
        name,
        type,
        projectId,
        defaultAccountId,
        displayOrder,
        isActive,
        createdBy: staffId,
      },
    });

    revalidatePath("/accounting/masters/expense-categories");
    return ok();
  } catch (e) {
    console.error("[createExpenseCategory] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
}

export async function updateExpenseCategory(
  id: number,
  data: Record<string, unknown>
): Promise<ActionResult> {
  try {
    const session = await getSession();
    const staffId = session.id;

    const updateData: Record<string, unknown> = {};

    if ("name" in data) {
      const name = (data.name as string).trim();
      if (!name) return err("名称は必須です");

      // Get current projectId for duplicate check scope
      const current = await prisma.expenseCategory.findUnique({
        where: { id },
        select: { projectId: true },
      });

      const existing = await prisma.expenseCategory.findFirst({
        where: { name, deletedAt: null, projectId: current?.projectId, id: { not: id } },
        select: { id: true },
      });
      if (existing) {
        return err(`費目「${name}」は既に登録されています`);
      }
      updateData.name = name;
    }

    if ("type" in data) {
      const type = data.type as string;
      if (!(VALID_TYPES as readonly string[]).includes(type)) {
        return err("無効な種別です");
      }
      updateData.type = type;
    }

    if ("projectId" in data) {
      if (!data.projectId) return err("プロジェクトは必須です");
      updateData.projectId = Number(data.projectId);
    }

    if ("defaultAccountId" in data) {
      updateData.defaultAccountId = data.defaultAccountId
        ? Number(data.defaultAccountId)
        : null;
    }

    if ("displayOrder" in data) {
      updateData.displayOrder = Number(data.displayOrder) || 0;
    }

    if ("isActive" in data) {
      updateData.isActive = toBoolean(data.isActive);
    }

    updateData.updatedBy = staffId;

    await prisma.expenseCategory.update({
      where: { id },
      data: updateData,
    });

    revalidatePath("/accounting/masters/expense-categories");
    return ok();
  } catch (e) {
    console.error("[updateExpenseCategory] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
}

export async function reorderExpenseCategories(
  orderedIds: number[]
): Promise<ActionResult> {
  try {
    const session = await getSession();
    const staffId = session.id;

    await prisma.$transaction(
      orderedIds.map((id, index) =>
        prisma.expenseCategory.update({
          where: { id },
          data: { displayOrder: index + 1, updatedBy: staffId },
        })
      )
    );

    revalidatePath("/accounting/masters/expense-categories");
    return ok();
  } catch (e) {
    console.error("[reorderExpenseCategories] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
}
