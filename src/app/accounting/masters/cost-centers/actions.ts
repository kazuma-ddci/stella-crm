"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { getSession } from "@/lib/auth";

// deprecated projectId との互換同期ヘルパー
// 1件のみ → その projectId / 0件 or 2件以上 → null
async function syncLegacyProjectId(
  costCenterId: number,
  projectIds: number[],
  tx?: Prisma.TransactionClient
): Promise<void> {
  const db = tx ?? prisma;
  const legacyProjectId = projectIds.length === 1 ? projectIds[0] : null;
  await db.costCenter.update({
    where: { id: costCenterId },
    data: { projectId: legacyProjectId },
  });
}

export async function createCostCenter(data: Record<string, unknown>) {
  const session = await getSession();
  const staffId = session.id;

  const name = (data.name as string).trim();
  const projectIds = Array.isArray(data.projectIds)
    ? (data.projectIds as string[]).map(Number).filter((n) => !isNaN(n))
    : [];
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
    throw new Error(`経理プロジェクト「${name}」は既に登録されています`);
  }

  // プロジェクトの存在チェック
  if (projectIds.length > 0) {
    const projects = await prisma.masterProject.findMany({
      where: { id: { in: projectIds } },
      select: { id: true },
    });
    if (projects.length !== projectIds.length) {
      throw new Error("指定されたプロジェクトの一部が見つかりません");
    }
  }

  await prisma.$transaction(async (tx) => {
    const costCenter = await tx.costCenter.create({
      data: {
        name,
        isActive,
        createdBy: staffId,
      },
    });

    if (projectIds.length > 0) {
      await tx.costCenterProjectAssignment.createMany({
        data: projectIds.map((projectId) => ({
          costCenterId: costCenter.id,
          projectId,
        })),
      });
    }

    await syncLegacyProjectId(costCenter.id, projectIds, tx);
  });

  revalidatePath("/accounting/masters/cost-centers");
}

export async function updateCostCenter(
  id: number,
  data: Record<string, unknown>
) {
  const session = await getSession();
  const staffId = session.id;

  await prisma.$transaction(async (tx) => {
    const updateData: Record<string, unknown> = {};

    if ("name" in data) {
      const name = (data.name as string).trim();
      if (!name) throw new Error("名称は必須です");

      // 名称重複チェック（自分自身は除く）
      const existing = await tx.costCenter.findFirst({
        where: { name, deletedAt: null, id: { not: id } },
        select: { id: true },
      });
      if (existing) {
        throw new Error(`経理プロジェクト「${name}」は既に登録されています`);
      }
      updateData.name = name;
    }

    if ("isActive" in data) {
      updateData.isActive = data.isActive === true || data.isActive === "true";
    }

    updateData.updatedBy = staffId;

    await tx.costCenter.update({
      where: { id },
      data: updateData,
    });

    // projectIds が含まれている場合、中間テーブルを差し替え
    if ("projectIds" in data) {
      const projectIds = Array.isArray(data.projectIds)
        ? (data.projectIds as string[]).map(Number).filter((n) => !isNaN(n))
        : [];

      // プロジェクトの存在チェック
      if (projectIds.length > 0) {
        const projects = await tx.masterProject.findMany({
          where: { id: { in: projectIds } },
          select: { id: true },
        });
        if (projects.length !== projectIds.length) {
          throw new Error("指定されたプロジェクトの一部が見つかりません");
        }
      }

      // 既存を削除 → 新規作成
      await tx.costCenterProjectAssignment.deleteMany({
        where: { costCenterId: id },
      });

      if (projectIds.length > 0) {
        await tx.costCenterProjectAssignment.createMany({
          data: projectIds.map((projectId) => ({
            costCenterId: id,
            projectId,
          })),
        });
      }

      await syncLegacyProjectId(id, projectIds, tx);
    }
  });

  revalidatePath("/accounting/masters/cost-centers");
}

export async function deleteCostCenter(id: number) {
  const session = await getSession();
  const staffId = session.id;

  await prisma.costCenter.update({
    where: { id },
    data: {
      deletedAt: new Date(),
      updatedBy: staffId,
    },
  });

  revalidatePath("/accounting/masters/cost-centers");
}
