import {
  getDashboardData,
  getAvailableMonths,
  getFunnelData,
  getLeadAcquisitionData,
  getRevenueTrendData,
} from "./actions";
import { getDeptKpiData } from "./dept-kpi-actions";
import { DashboardClient } from "./dashboard-client";

type Props = {
  searchParams: Promise<{ month?: string }>;
};

export default async function StpDashboardPage({ searchParams }: Props) {
  const params = await searchParams;
  const now = new Date();
  const currentYearMonth =
    params.month ??
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const [data, months, funnelData, leadData, revenueTrendData, deptKpiData] =
    await Promise.all([
      getDashboardData(currentYearMonth),
      getAvailableMonths(),
      getFunnelData(),
      getLeadAcquisitionData(currentYearMonth),
      getRevenueTrendData(currentYearMonth),
      getDeptKpiData(currentYearMonth),
    ]);

  return (
    <DashboardClient
      data={data}
      months={months}
      currentMonth={currentYearMonth}
      funnelData={funnelData}
      leadData={leadData}
      revenueTrendData={revenueTrendData}
      deptKpiData={deptKpiData}
    />
  );
}
