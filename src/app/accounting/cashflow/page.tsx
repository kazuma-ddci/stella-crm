import { getCashflowForecast } from "./actions";
import { CashflowClient } from "./cashflow-client";

type Props = {
  searchParams: Promise<{
    days?: string;
  }>;
};

export default async function CashflowPage({ searchParams }: Props) {
  const params = await searchParams;
  const forecastDays = params.days ? Number(params.days) : 90;

  const data = await getCashflowForecast(forecastDays);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">キャッシュフロー予測</h1>
      <CashflowClient data={data} forecastDays={forecastDays} />
    </div>
  );
}
