import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { MONTHLY_KPI_KEYS, DEPT_KPI_KEYS } from "@/lib/kpi/constants";
import { authorizeApi } from "@/lib/api-auth";

// 注: KPI管理は現状STPプロジェクトのみで使用されている。
// 他プロジェクトでKPI機能を実装する際は、ここの権限チェックを拡張する必要あり。
// 詳細はメモ memory/kpi_stp_only_scope.md を参照。
export async function GET(request: NextRequest) {
  // STPプロジェクトの閲覧権限以上を要求(現状KPIはSTPのみで使用)
  const authz = await authorizeApi([{ project: "stp", level: "view" }]);
  if (!authz.ok) return authz.response;

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
