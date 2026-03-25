import {
  getDashboardKgiData,
  getAvailableMonths,
  getFunnelData,
  getLeadAcquisitionData,
  getRevenueTrendWithProfitData,
  getAgentRoiData,
  getLeadSourceForecastData,
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

  const [
    kgiData,
    months,
    funnelData,
    leadData,
    revenueTrendData,
    deptKpiData,
    agentRoiData,
    leadSourceForecastData,
  ] = await Promise.all([
    getDashboardKgiData(currentYearMonth),
    getAvailableMonths(),
    getFunnelData(),
    getLeadAcquisitionData(currentYearMonth),
    getRevenueTrendWithProfitData(currentYearMonth),
    getDeptKpiData(currentYearMonth),
    getAgentRoiData(currentYearMonth),
    getLeadSourceForecastData(currentYearMonth),
  ]);

  return (
    <DashboardClient
      kgiData={kgiData}
      months={months}
      currentMonth={currentYearMonth}
      funnelData={funnelData}
      leadData={leadData}
      revenueTrendData={revenueTrendData}
      deptKpiData={deptKpiData}
      agentRoiData={agentRoiData}
      leadSourceForecastData={leadSourceForecastData}
    />
  );
}
