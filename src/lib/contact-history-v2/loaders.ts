import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import {
  contactHistoryV2DisplayInclude,
  type ContactHistoryV2WithRelations,
} from "./types";

/**
 * 接触履歴 統一版（V2）の共有ローダー。
 * プロジェクトコード（slp/hojo/stp）を引数に取り、該当プロジェクトの接触履歴のみを返す。
 */

export interface ListContactHistoriesV2Options {
  projectCode: string;
  status?: string | string[];
  includeDeleted?: boolean;
  limit?: number;
  offset?: number;
}

/**
 * プロジェクトコードからプロジェクトIDを解決する。
 * 存在しないコードの場合は null を返す。
 */
export async function resolveProjectIdByCode(projectCode: string): Promise<number | null> {
  const project = await prisma.masterProject.findFirst({
    where: { code: projectCode },
    select: { id: true },
  });
  return project?.id ?? null;
}

/**
 * 指定プロジェクトの接触履歴一覧を取得する。
 * 予定/実績を status で絞り込み可能。
 */
export async function listContactHistoriesV2(
  options: ListContactHistoriesV2Options,
): Promise<ContactHistoryV2WithRelations[]> {
  const projectId = await resolveProjectIdByCode(options.projectCode);
  if (projectId === null) {
    return [];
  }

  const where: Prisma.ContactHistoryV2WhereInput = {
    projectId,
  };

  if (!options.includeDeleted) {
    where.deletedAt = null;
  }

  if (options.status) {
    if (Array.isArray(options.status)) {
      where.status = { in: options.status };
    } else {
      where.status = options.status;
    }
  }

  return prisma.contactHistoryV2.findMany({
    where,
    include: contactHistoryV2DisplayInclude,
    orderBy: [
      { scheduledStartAt: "desc" },
      { id: "desc" },
    ],
    take: options.limit,
    skip: options.offset,
  });
}

/**
 * ID 指定で1件取得する。
 * プロジェクト横断で取得する場合は projectCode を省略する。
 */
export async function getContactHistoryV2ById(
  id: number,
  options?: { projectCode?: string; includeDeleted?: boolean },
): Promise<ContactHistoryV2WithRelations | null> {
  const where: Prisma.ContactHistoryV2WhereInput = { id };
  if (!options?.includeDeleted) {
    where.deletedAt = null;
  }
  if (options?.projectCode) {
    const projectId = await resolveProjectIdByCode(options.projectCode);
    if (projectId === null) return null;
    where.projectId = projectId;
  }

  return prisma.contactHistoryV2.findFirst({
    where,
    include: contactHistoryV2DisplayInclude,
  });
}

/**
 * 件数カウント（ダッシュボードやページネーション用）。
 */
export async function countContactHistoriesV2(
  options: Omit<ListContactHistoriesV2Options, "limit" | "offset">,
): Promise<number> {
  const projectId = await resolveProjectIdByCode(options.projectCode);
  if (projectId === null) return 0;

  const where: Prisma.ContactHistoryV2WhereInput = { projectId };
  if (!options.includeDeleted) where.deletedAt = null;
  if (options.status) {
    where.status = Array.isArray(options.status)
      ? { in: options.status }
      : options.status;
  }

  return prisma.contactHistoryV2.count({ where });
}

/**
 * 指定した顧客エンティティ (targetType + targetId) に紐づく接触履歴を取得。
 * 詳細ページ内の「接触履歴」セクションで使用。
 */
export async function listContactHistoriesV2ForEntity(options: {
  projectCode: string;
  targetType: string;
  targetId: number | null;
  limit?: number;
}): Promise<ContactHistoryV2WithRelations[]> {
  const projectId = await resolveProjectIdByCode(options.projectCode);
  if (projectId === null) return [];

  return prisma.contactHistoryV2.findMany({
    where: {
      projectId,
      deletedAt: null,
      customerParticipants: {
        some: {
          targetType: options.targetType,
          ...(options.targetId !== null ? { targetId: options.targetId } : { targetId: null }),
        },
      },
    },
    include: contactHistoryV2DisplayInclude,
    orderBy: [{ scheduledStartAt: "desc" }, { id: "desc" }],
    take: options.limit,
  });
}

/**
 * 指定した顧客エンティティ の接触履歴件数。
 */
export async function countContactHistoriesV2ForEntity(options: {
  projectCode: string;
  targetType: string;
  targetId: number | null;
}): Promise<number> {
  const projectId = await resolveProjectIdByCode(options.projectCode);
  if (projectId === null) return 0;

  return prisma.contactHistoryV2.count({
    where: {
      projectId,
      deletedAt: null,
      customerParticipants: {
        some: {
          targetType: options.targetType,
          ...(options.targetId !== null ? { targetId: options.targetId } : { targetId: null }),
        },
      },
    },
  });
}
