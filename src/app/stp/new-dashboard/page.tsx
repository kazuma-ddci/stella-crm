import { getNewDashboardData } from "./actions";
import { NewDashboardClient } from "./new-dashboard-client";

type SearchParams = {
  tab?: string;
  period?: string;
  product?: string;
  staff?: string;
  mode?: string;
};

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

  return (
    <NewDashboardClient
      initialSearchParams={params}
      data={dashboardData}
    />
  );
}
