import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { MONTHLY_KPI_KEYS, DEPT_KPI_KEYS } from "@/lib/kpi/constants";

export async function GET(request: NextRequest) {
  const month = request.nextUrl.searchParams.get("month");
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json({ error: "Invalid month" }, { status: 400 });
  }

  const targets = await prisma.kpiMonthlyTarget.findMany({
    where: { yearMonth: month },
  });

  const map = new Map(targets.map((t) => [t.kpiKey, t.targetValue]));

  // KGI目標
  const result: Record<string, number | null> = {
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
  };

  // 部門KPI目標
  for (const key of Object.values(DEPT_KPI_KEYS)) {
    result[key] = map.get(key) ?? null;
  }

  return NextResponse.json(result);
}
