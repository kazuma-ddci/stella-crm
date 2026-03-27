"use server";

import { prisma } from "@/lib/prisma";

// STP関連テーブル（正確なDBテーブル名 → 日本語ラベル）
const STP_TABLES: Record<string, string> = {
  stp_companies: "企業情報",
  stp_agents: "代理店情報",
  stp_candidates: "求職者情報",
  stp_contract_histories: "契約履歴",
  master_contracts: "契約書",
  contact_histories: "接触履歴",
  stp_stage_histories: "ステージ変更",
  stp_lead_form_submissions: "リード回答",
  stp_proposals: "提案書",
  stp_revenue_records: "売上レコード",
  stp_expense_records: "経費レコード",
  stp_invoices: "請求書",
  alert_acknowledgments: "アラート対応",
};

const STP_TABLE_NAMES = Object.keys(STP_TABLES);

const ACTION_LABELS: Record<string, string> = {
  create: "作成",
  update: "更新",
  delete: "削除",
};

export type ActivityLogEntry = {
  id: number;
  tableName: string;
  tableLabel: string;
  recordId: number;
  action: string;
  actionLabel: string;
  summary: string | null;
  changes: Record<string, unknown> | null;
  userId: number | null;
  staffName: string | null;
  createdAt: string;
};

export type ActivityLogResult = {
  entries: ActivityLogEntry[];
  totalCount: number;
  hasMore: boolean;
};

export async function getActivityLogs(
  page: number = 1,
  pageSize: number = 50,
  filters?: {
    tableName?: string;
    action?: string;
    userId?: number;
    startDate?: string;
    endDate?: string;
  }
): Promise<ActivityLogResult> {
  const where: Record<string, unknown> = {
    tableName: filters?.tableName
      ? filters.tableName
      : { in: STP_TABLE_NAMES },
  };
  if (filters?.action) where.action = filters.action;
  if (filters?.userId) where.userId = filters.userId;
  if (filters?.startDate || filters?.endDate) {
    const dateFilter: Record<string, Date> = {};
    if (filters.startDate) dateFilter.gte = new Date(filters.startDate);
    if (filters.endDate) {
      const end = new Date(filters.endDate);
      end.setHours(23, 59, 59, 999);
      dateFilter.lte = end;
    }
    where.createdAt = dateFilter;
  }

  const [logs, totalCount] = await Promise.all([
    prisma.activityLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        staff: {
          select: { id: true, name: true },
        },
      },
    }),
    prisma.activityLog.count({ where }),
  ]);

  const entries: ActivityLogEntry[] = logs.map((log) => {
    const changesObj = log.changes as Record<string, unknown> | null;
    const summary =
      changesObj && typeof changesObj._summary === "string"
        ? changesObj._summary
        : null;

    let changes: Record<string, unknown> | null = null;
    if (changesObj) {
      const filtered = Object.fromEntries(
        Object.entries(changesObj).filter(([k]) => k !== "_summary")
      );
      if (Object.keys(filtered).length > 0) {
        changes = filtered;
      }
    }

    return {
      id: log.id,
      tableName: log.tableName,
      tableLabel: STP_TABLES[log.tableName] ?? log.tableName,
      recordId: log.recordId,
      action: log.action,
      actionLabel: ACTION_LABELS[log.action] ?? log.action,
      summary,
      changes,
      userId: log.userId,
      staffName: log.staff?.name ?? null,
      createdAt: log.createdAt.toISOString(),
    };
  });

  return {
    entries,
    totalCount,
    hasMore: page * pageSize < totalCount,
  };
}

export async function getLogTableNames(): Promise<
  { value: string; label: string }[]
> {
  const result = await prisma.activityLog.groupBy({
    by: ["tableName"],
    where: { tableName: { in: STP_TABLE_NAMES } },
    _count: true,
    orderBy: { _count: { tableName: "desc" } },
  });

  return result.map((r) => ({
    value: r.tableName,
    label: STP_TABLES[r.tableName] ?? r.tableName,
  }));
}

export async function getLogStaffList(): Promise<
  { id: number; name: string }[]
> {
  const result = await prisma.activityLog.groupBy({
    by: ["userId"],
    where: { tableName: { in: STP_TABLE_NAMES } },
    _count: true,
    orderBy: { _count: { userId: "desc" } },
  });

  const userIds = result
    .map((r) => r.userId)
    .filter((id): id is number => id !== null);

  if (userIds.length === 0) return [];

  return prisma.masterStaff.findMany({
    where: { id: { in: userIds } },
    select: { id: true, name: true },
  });
}
