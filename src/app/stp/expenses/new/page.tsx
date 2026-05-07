import {
  getExpenseFormData,
  getMyExpenses,
  getMyExpenseDashboard,
  getProjectRecurringTransactions,
  getMonthlyExpenseSummary,
  getPendingApprovals,
} from "@/app/finance/expenses/actions";
import { ExpensePageClient } from "@/app/finance/expenses/expense-page-client";
import { prisma } from "@/lib/prisma";

type Props = {
  searchParams: Promise<{ month?: string }>;
};

export default async function StpExpenseNewPage({ searchParams }: Props) {
  const params = await searchParams;
  const project = await prisma.masterProject.findFirst({
    where: { code: "stp" },
    select: { id: true },
  });
  const projectId = project?.id ?? 0;

  const [formData, myExpenses, dashboard, recurring, monthly, approvals] = await Promise.all([
    getExpenseFormData("stp"),
    getMyExpenses(projectId, true),
    getMyExpenseDashboard(projectId, params.month),
    getProjectRecurringTransactions(projectId),
    getMonthlyExpenseSummary(projectId),
    getPendingApprovals(projectId),
  ]);

  return (
    <div className="p-6 pb-0 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">社内経費申請</h1>
        <p className="text-sm text-muted-foreground mt-1">
          会食・単発購入・ツール代・サブスクなど、社内で発生するプロジェクト経費を申請します。
        </p>
      </div>
      <ExpensePageClient
        formData={formData}
        mode="project"
        backUrl="/stp/expenses/new?tab=status"
        myExpenses={myExpenses}
        myExpenseDashboard={dashboard}
        recurringTransactions={recurring}
        monthlySummary={monthly}
        pendingApprovals={approvals}
      />
    </div>
  );
}
