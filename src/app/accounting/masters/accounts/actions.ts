"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { toBoolean } from "@/lib/utils";
import { ok, err, type ActionResult } from "@/lib/action-result";

const VALID_CATEGORIES = [
  "asset", "liability", "equity", "revenue", "cost_of_sales",
  "sga", "non_operating_revenue", "non_operating_expense",
  "extraordinary_income", "extraordinary_loss",
] as const;

export async function createAccount(
  data: Record<string, unknown>
): Promise<ActionResult> {
  try {
    const session = await getSession();
    const staffId = session.id;

    const code = (data.code as string).trim();
    const name = (data.name as string).trim();
    const category = data.category as string;
    const subcategory = data.subcategory ? (data.subcategory as string).trim() : null;
    const displayOrder = data.displayOrder ? Number(data.displayOrder) : 0;
    const isActive = data.isActive !== false && data.isActive !== "false";

    if (!code || !name || !category) {
      return err("科目コード、科目名、区分は必須です");
    }

    if (!(VALID_CATEGORIES as readonly string[]).includes(category)) {
      return err("無効な区分です");
    }

    // 科目コード重複チェック
    const existing = await prisma.account.findUnique({
      where: { code },
      select: { id: true },
    });
    if (existing) {
      return err(`科目コード「${code}」は既に使用されています`);
    }

    await prisma.account.create({
      data: {
        code,
        name,
        category,
        subcategory,
        displayOrder,
        isActive,
        createdBy: staffId,
      },
    });

    revalidatePath("/accounting/masters/accounts");
    return ok();
  } catch (e) {
    console.error("[createAccount] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
}

export async function updateAccount(
  id: number,
  data: Record<string, unknown>
): Promise<ActionResult> {
  try {
    const session = await getSession();
    const staffId = session.id;

    const updateData: Record<string, unknown> = {};

    if ("code" in data) {
      const code = (data.code as string).trim();
      if (!code) return err("科目コードは必須です");

      // 科目コード重複チェック（自分自身は除く）
      const existing = await prisma.account.findFirst({
        where: { code, id: { not: id } },
        select: { id: true },
      });
      if (existing) {
        return err(`科目コード「${code}」は既に使用されています`);
      }
      updateData.code = code;
    }

    if ("name" in data) {
      const name = (data.name as string).trim();
      if (!name) return err("科目名は必須です");
      updateData.name = name;
    }

    if ("category" in data) {
      const category = data.category as string;
      if (!(VALID_CATEGORIES as readonly string[]).includes(category)) {
        return err("無効な区分です");
      }
      updateData.category = category;
    }

    if ("subcategory" in data) {
      updateData.subcategory = data.subcategory ? (data.subcategory as string).trim() : null;
    }

    if ("displayOrder" in data) {
      updateData.displayOrder = Number(data.displayOrder) || 0;
    }

    if ("isActive" in data) {
      updateData.isActive = toBoolean(data.isActive);
    }

    updateData.updatedBy = staffId;

    await prisma.account.update({
      where: { id },
      data: updateData,
    });

    revalidatePath("/accounting/masters/accounts");
    return ok();
  } catch (e) {
    console.error("[updateAccount] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
}

export async function reorderAccounts(
  orderedIds: number[]
): Promise<ActionResult> {
  try {
    const session = await getSession();
    const staffId = session.id;

    await prisma.$transaction(
      orderedIds.map((id, index) =>
        prisma.account.update({
          where: { id },
          data: { displayOrder: index + 1, updatedBy: staffId },
        })
      )
    );

    revalidatePath("/accounting/masters/accounts");
    return ok();
  } catch (e) {
    console.error("[reorderAccounts] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
}
