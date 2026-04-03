"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { toBoolean } from "@/lib/utils";

export async function createCostCenter(data: Record<string, unknown>) {
  const session = await getSession();
  const staffId = session.id;

  const name = (data.name as string).trim();
  const projectId = data.projectId ? Number(data.projectId) : null;
  const isActive = data.isActive !== false && data.isActive !== "false";

  if (!name) {
    throw new Error("名称は必須です");
  }

  // 名称重複チェック
  const existing = await prisma.costCenter.findFirst({
    where: { name, deletedAt: null },
    select: { id: true },
  });
  if (existing) {
    throw new Error(`按分先「${name}」は既に登録されています`);
  }

  // プロジェクトの存在チェック
  if (projectId) {
    const project = await prisma.masterProject.findUnique({
      where: { id: projectId },
      select: { id: true },
    });
    if (!project) {
      throw new Error("指定されたプロジェクトが見つかりません");
    }
  }

  await prisma.costCenter.create({
    data: {
      name,
      projectId,
      isActive,
      createdBy: staffId,
    },
  });

  revalidatePath("/accounting/masters/cost-centers");
}

export async function updateCostCenter(
  id: number,
  data: Record<string, unknown>
) {
  const session = await getSession();
  const staffId = session.id;

  const updateData: Record<string, unknown> = {};

  if ("name" in data) {
    const name = (data.name as string).trim();
    if (!name) throw new Error("名称は必須です");

    // 名称重複チェック（自分自身は除く）
    const existing = await prisma.costCenter.findFirst({
      where: { name, deletedAt: null, id: { not: id } },
      select: { id: true },
    });
    if (existing) {
      throw new Error(`按分先「${name}」は既に登録されています`);
    }
    updateData.name = name;
  }

  if ("projectId" in data) {
    const projectId = data.projectId ? Number(data.projectId) : null;
    if (projectId) {
      const project = await prisma.masterProject.findUnique({
        where: { id: projectId },
        select: { id: true },
      });
      if (!project) {
        throw new Error("指定されたプロジェクトが見つかりません");
      }
    }
    updateData.projectId = projectId;
  }

  if ("isActive" in data) {
    updateData.isActive = toBoolean(data.isActive);
  }

  updateData.updatedBy = staffId;

  await prisma.costCenter.update({
    where: { id },
    data: updateData,
  });

  revalidatePath("/accounting/masters/cost-centers");
}
