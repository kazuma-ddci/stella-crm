import { getBudgets, getBudgetFormData, getBudgetVsActual } from "./actions";
import { BudgetPageClient } from "./budget-page-client";

type Props = {
  searchParams: Promise<{
    year?: string;
    costCenter?: string;
  }>;
};

export default async function BudgetPage({ searchParams }: Props) {
  const params = await searchParams;
  const fiscalYear = params.year ? Number(params.year) : new Date().getFullYear();

  // costCenter: undefined = すべて, "all" = 全社(null), 数字 = 特定コストセンター
  let costCenterId: number | null | undefined = undefined;
  if (params.costCenter === "all") {
    costCenterId = null;
  } else if (params.costCenter) {
    costCenterId = Number(params.costCenter);
  }

  const [budgets, formData, budgetVsActual] = await Promise.all([
    getBudgets(fiscalYear, costCenterId),
    getBudgetFormData(),
    getBudgetVsActual(fiscalYear, undefined, costCenterId),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">予実管理</h1>
      <BudgetPageClient
        budgets={budgets}
        budgetVsActual={budgetVsActual}
        formData={formData}
        fiscalYear={fiscalYear}
        costCenterId={costCenterId}
      />
    </div>
  );
}
