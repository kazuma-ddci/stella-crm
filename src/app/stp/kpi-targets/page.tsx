import { getKpiTargets, getDeptKpiTargets, getTargetMonths, getFiscalYearStart } from "./actions";
import { KpiTargetsClient } from "./kpi-targets-client";

export default async function KpiTargetsPage() {
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const [targets, deptTargets, months, fiscalYearStart] = await Promise.all([
    getKpiTargets(currentMonth),
    getDeptKpiTargets(currentMonth),
    getTargetMonths(),
    getFiscalYearStart(),
  ]);

  return (
    <KpiTargetsClient
      months={months}
      initialMonth={currentMonth}
      initialTargets={targets}
      initialDeptTargets={deptTargets}
      initialFiscalYearStart={fiscalYearStart}
    />
  );
}
