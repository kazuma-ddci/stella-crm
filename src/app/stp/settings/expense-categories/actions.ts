"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireEdit } from "@/lib/auth";
import { getSystemProjectContext } from "@/lib/project-context";
import { toBoolean } from "@/lib/utils";
import { ok, err, type ActionResult } from "@/lib/action-result";

const VALID_TYPES = ["revenue", "expense", "both"] as const;

async function getStpProjectId(): Promise<number> {
  const ctx = await getSystemProjectContext("stp");
  if (!ctx) throw new Error("STPプロジェクトのコンテキストが取得できません");
  return ctx.projectId;
}

export async function createExpenseCategory(data: Record<string, unknown>): Promise<ActionResult> {
 try {
  const session = await requireEdit("stp");
  const staffId = session.id;
  const projectId = await getStpProjectId();

  const name = (data.name as string).trim();
  const type = data.type as string;
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
      displayOrder,
      isActive,
      createdBy: staffId,
    },
  });

  revalidatePath("/stp/settings/expense-categories");
  revalidatePath("/stp/finance/generate");
  revalidatePath("/stp/finance/transactions");
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
  const session = await requireEdit("stp");
  const staffId = session.id;
  const projectId = await getStpProjectId();

  // 自プロジェクトの費目のみ編集可能
  const target = await prisma.expenseCategory.findFirst({
    where: { id, projectId, deletedAt: null },
  });
  if (!target) {
    return err("この費目は編集できません");
  }

  const updateData: Record<string, unknown> = {};

  if ("name" in data) {
    const name = (data.name as string).trim();
    if (!name) return err("名称は必須です");

    const existing = await prisma.expenseCategory.findFirst({
      where: { name, deletedAt: null, projectId, id: { not: id } },
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
    // システム費目は種別変更不可
    if (target.systemCode && type !== target.type) {
      return err("システム費目の種別は変更できません");
    }
    updateData.type = type;
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

  revalidatePath("/stp/settings/expense-categories");
  revalidatePath("/stp/finance/generate");
  revalidatePath("/stp/finance/transactions");
  return ok();
 } catch (e) {
  console.error("[updateExpenseCategory] error:", e);
  return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
 }
}

export async function deleteExpenseCategory(id: number): Promise<ActionResult> {
 try {
  const session = await requireEdit("stp");
  const staffId = session.id;
  const projectId = await getStpProjectId();

  const target = await prisma.expenseCategory.findFirst({
    where: { id, projectId, deletedAt: null },
  });
  if (!target) {
    return err("この費目は削除できません");
  }
  if (target.systemCode) {
    return err("システム費目は削除できません");
  }

  await prisma.expenseCategory.update({
    where: { id },
    data: { deletedAt: new Date(), updatedBy: staffId },
  });

  revalidatePath("/stp/settings/expense-categories");
  revalidatePath("/stp/finance/generate");
  revalidatePath("/stp/finance/transactions");
  return ok();
 } catch (e) {
  console.error("[deleteExpenseCategory] error:", e);
  return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
 }
}

export async function reorderExpenseCategories(orderedIds: number[]): Promise<ActionResult> {
 try {
  const session = await requireEdit("stp");
  const staffId = session.id;

  await prisma.$transaction(
    orderedIds.map((id, index) =>
      prisma.expenseCategory.update({
        where: { id },
        data: { displayOrder: index + 1, updatedBy: staffId },
      })
    )
  );

  revalidatePath("/stp/settings/expense-categories");
  return ok();
 } catch (e) {
  console.error("[reorderExpenseCategories] error:", e);
  return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
 }
}
