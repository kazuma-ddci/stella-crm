"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import {
  KPI_KEYS,
  MONTHLY_KPI_KEYS,
  DEPT_KPI_KEYS,
  type MonthlyKpiKey,
  type DeptKpiKey,
} from "@/lib/kpi/constants";
import { requireStaffWithProjectPermission } from "@/lib/auth/staff-action";

// 注: KPI管理は現状STPプロジェクトのみで使用されている。
// 詳細は memory/kpi_stp_only_scope.md を参照。
// このファイル内の関数は全てSTPプロジェクトの権限で保護する。

export type KpiTargets = Record<MonthlyKpiKey, number | null>;
export type DeptKpiTargets = Record<DeptKpiKey, number | null>;

export async function getKpiTargets(yearMonth: string): Promise<KpiTargets> {
  // 認証: STPプロジェクトの閲覧権限以上
  await requireStaffWithProjectPermission([{ project: "stp", level: "view" }]);
  const targets = await prisma.kpiMonthlyTarget.findMany({
    where: { yearMonth },
  });

  const map = new Map(targets.map((t) => [t.kpiKey, t.targetValue]));

  return {
    [MONTHLY_KPI_KEYS.MONTHLY_REVENUE]:
      map.get(MONTHLY_KPI_KEYS.MONTHLY_REVENUE) ?? null,
    [MONTHLY_KPI_KEYS.MONTHLY_GROSS_PROFIT]:
      map.get(MONTHLY_KPI_KEYS.MONTHLY_GROSS_PROFIT) ?? null,
    [MONTHLY_KPI_KEYS.NEW_CONTRACTS]:
      map.get(MONTHLY_KPI_KEYS.NEW_CONTRACTS) ?? null,
    [MONTHLY_KPI_KEYS.FIXED_COST]:
      map.get(MONTHLY_KPI_KEYS.FIXED_COST) ?? null,
    [MONTHLY_KPI_KEYS.MONTHLY_LEADS]:
      map.get(MONTHLY_KPI_KEYS.MONTHLY_LEADS) ?? null,
  } as KpiTargets;
}

export async function saveKpiTargets(
  yearMonth: string,
  targets: KpiTargets
): Promise<void> {
  await requireStaffWithProjectPermission([{ project: "stp", level: "edit" }]);
  const entries = Object.entries(targets) as [MonthlyKpiKey, number | null][];

  await prisma.$transaction(
    entries
      .filter(([, value]) => value !== null)
      .map(([kpiKey, targetValue]) =>
        prisma.kpiMonthlyTarget.upsert({
          where: { yearMonth_kpiKey: { yearMonth, kpiKey } },
          update: { targetValue: targetValue! },
          create: { yearMonth, kpiKey, targetValue: targetValue! },
        })
      )
  );

  revalidatePath("/stp/dashboard");
  revalidatePath("/stp/kpi-targets");
}

function getPrevYearMonth(yearMonth: string): string {
  const [y, m] = yearMonth.split("-").map(Number);
  const prevDate = new Date(y, m - 2, 1);
  return `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, "0")}`;
}

export async function copyFromPreviousMonth(
  yearMonth: string
): Promise<KpiTargets> {
  // 内部で getKpiTargets を呼ぶので個別の認証チェックは不要だが、念のため
  await requireStaffWithProjectPermission([{ project: "stp", level: "view" }]);
  return getKpiTargets(getPrevYearMonth(yearMonth));
}

export async function copyDeptFromPreviousMonth(
  yearMonth: string
): Promise<DeptKpiTargets> {
  await requireStaffWithProjectPermission([{ project: "stp", level: "view" }]);
  return getDeptKpiTargets(getPrevYearMonth(yearMonth));
}

export async function copyLeadSourceFromPreviousMonth(
  yearMonth: string,
  sourceIds: number[]
): Promise<LeadSourceTargets> {
  await requireStaffWithProjectPermission([{ project: "stp", level: "view" }]);
  return getLeadSourceTargets(getPrevYearMonth(yearMonth), sourceIds);
}

/** 決算期首月を取得（デフォルト: 4月） */
export async function getFiscalYearStart(): Promise<number> {
  await requireStaffWithProjectPermission([{ project: "stp", level: "view" }]);
  const record = await prisma.kpiMonthlyTarget.findUnique({
    where: {
      yearMonth_kpiKey: {
        yearMonth: "0000-00",
        kpiKey: KPI_KEYS.FISCAL_YEAR_START,
      },
    },
  });
  return record?.targetValue ?? 4;
}

/** 決算期首月を保存 */
export async function saveFiscalYearStart(month: number): Promise<void> {
  await requireStaffWithProjectPermission([{ project: "stp", level: "edit" }]);
  await prisma.kpiMonthlyTarget.upsert({
    where: {
      yearMonth_kpiKey: {
        yearMonth: "0000-00",
        kpiKey: KPI_KEYS.FISCAL_YEAR_START,
      },
    },
    update: { targetValue: month },
    create: {
      yearMonth: "0000-00",
      kpiKey: KPI_KEYS.FISCAL_YEAR_START,
      targetValue: month,
    },
  });

  revalidatePath("/stp/dashboard");
  revalidatePath("/stp/kpi-targets");
}

/** 利用可能な月のリスト（目標設定用 - 今月±12ヶ月） */
export async function getTargetMonths(): Promise<string[]> {
  await requireStaffWithProjectPermission([{ project: "stp", level: "view" }]);
  const now = new Date();
  const months: string[] = [];

  for (let i = -6; i <= 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    months.push(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
    );
  }

  return months;
}

// ============================================
// 部門KPI目標
// ============================================

const ALL_DEPT_KPI_KEYS = Object.values(DEPT_KPI_KEYS);

export async function getDeptKpiTargets(yearMonth: string): Promise<DeptKpiTargets> {
  await requireStaffWithProjectPermission([{ project: "stp", level: "view" }]);
  const targets = await prisma.kpiMonthlyTarget.findMany({
    where: {
      yearMonth,
      kpiKey: { in: ALL_DEPT_KPI_KEYS },
    },
  });

  const map = new Map(targets.map((t) => [t.kpiKey, t.targetValue]));

  const result: Record<string, number | null> = {};
  for (const key of ALL_DEPT_KPI_KEYS) {
    result[key] = map.get(key) ?? null;
  }
  return result as DeptKpiTargets;
}

export async function saveDeptKpiTargets(
  yearMonth: string,
  targets: DeptKpiTargets
): Promise<void> {
  await requireStaffWithProjectPermission([{ project: "stp", level: "edit" }]);
  const entries = Object.entries(targets) as [DeptKpiKey, number | null][];

  await prisma.$transaction(
    entries
      .filter(([, value]) => value !== null)
      .map(([kpiKey, targetValue]) =>
        prisma.kpiMonthlyTarget.upsert({
          where: { yearMonth_kpiKey: { yearMonth, kpiKey } },
          update: { targetValue: targetValue! },
          create: { yearMonth, kpiKey, targetValue: targetValue! },
        })
      )
  );

  revalidatePath("/stp/dashboard");
  revalidatePath("/stp/kpi-targets");
}

// ============================================
// 流入経路別目標
// ============================================

export type LeadSourceItem = {
  id: number;
  name: string;
};

export type LeadSourceTargets = Record<string, number | null>;

export async function getLeadSources(): Promise<LeadSourceItem[]> {
  await requireStaffWithProjectPermission([{ project: "stp", level: "view" }]);
  const sources = await prisma.stpLeadSource.findMany({
    where: { isActive: true },
    select: { id: true, name: true },
    orderBy: { displayOrder: "asc" },
  });
  return sources;
}

export async function getLeadSourceTargets(
  yearMonth: string,
  sourceIds: number[]
): Promise<LeadSourceTargets> {
  await requireStaffWithProjectPermission([{ project: "stp", level: "view" }]);
  const keys = sourceIds.map((id) => `lead_source_target_${id}`);
  const targets = await prisma.kpiMonthlyTarget.findMany({
    where: { yearMonth, kpiKey: { in: keys } },
  });
  const map = new Map(targets.map((t) => [t.kpiKey, t.targetValue]));

  const result: LeadSourceTargets = {};
  for (const id of sourceIds) {
    const key = `lead_source_target_${id}`;
    result[key] = map.get(key) ?? null;
  }
  return result;
}

export async function saveLeadSourceTargets(
  yearMonth: string,
  targets: LeadSourceTargets
): Promise<void> {
  await requireStaffWithProjectPermission([{ project: "stp", level: "edit" }]);
  const entries = Object.entries(targets);

  await prisma.$transaction(
    entries
      .filter(([, value]) => value !== null && value !== undefined)
      .map(([kpiKey, targetValue]) =>
        prisma.kpiMonthlyTarget.upsert({
          where: { yearMonth_kpiKey: { yearMonth, kpiKey } },
          update: { targetValue: targetValue! },
          create: { yearMonth, kpiKey, targetValue: targetValue! },
        })
      )
  );

  revalidatePath("/stp/dashboard");
  revalidatePath("/stp/kpi-targets");
}
