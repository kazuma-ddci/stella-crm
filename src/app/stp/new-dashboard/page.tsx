import { getNewDashboardData } from "./actions";
import { NewDashboardClient } from "./new-dashboard-client";
import { redirect } from "next/navigation";

type SearchParams = {
  tab?: string;
  period?: string;
  product?: string;
  staff?: string;
  mode?: string;
};

const VALID_TABS = new Set(["funnel", "channel", "deals", "exit-kpi", "management"]);
const VALID_MODES = new Set(["current", "cohort", "snapshot"]);

type Props = {
  searchParams: Promise<SearchParams>;
};

export default async function StpNewDashboardPage({ searchParams }: Props) {
  const params = await searchParams;
  const dashboardData = await getNewDashboardData({
    period: params.period,
    product: params.product,
    staff: params.staff,
  });
  const normalizedParams = new URLSearchParams();
  normalizedParams.set("tab", params.tab && VALID_TABS.has(params.tab) ? params.tab : "funnel");
  normalizedParams.set("period", dashboardData.selectedPeriod);
  normalizedParams.set("product", dashboardData.selectedProduct);
  normalizedParams.set("staff", dashboardData.selectedStaff);
  normalizedParams.set("mode", params.mode && VALID_MODES.has(params.mode) ? params.mode : "current");
  const currentParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) currentParams.set(key, value);
  }
  if (currentParams.toString() !== normalizedParams.toString()) {
    redirect(`/stp/new-dashboard?${normalizedParams.toString()}`);
  }

  return (
    <NewDashboardClient
      initialSearchParams={params}
      data={dashboardData}
    />
  );
}
