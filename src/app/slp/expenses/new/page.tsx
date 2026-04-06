import {
  getExpenseFormData,
  getMyExpenses,
  getProjectRecurringTransactions,
  getMonthlyExpenseSummary,
  getPendingApprovals,
} from "@/app/accounting/expenses/new/actions";
import { ExpensePageClient } from "@/app/accounting/expenses/new/expense-page-client";
import { prisma } from "@/lib/prisma";

export default async function SlpExpenseNewPage() {
  const project = await prisma.masterProject.findFirst({
    where: { code: "slp" },
    select: { id: true },
  });
  const projectId = project?.id ?? 0;

  const [formData, myExpenses, recurring, monthly, approvals] = await Promise.all([
    getExpenseFormData("slp"),
    getMyExpenses(projectId),
    getProjectRecurringTransactions(projectId),
    getMonthlyExpenseSummary(projectId),
    getPendingApprovals(projectId),
  ]);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">経費申請</h1>
        <p className="text-sm text-muted-foreground mt-1">
          経費を申請します。登録後は経理の承認を経て仕訳フローに進みます。
        </p>
      </div>
      <ExpensePageClient
        formData={formData}
        mode="project"
        backUrl="/slp"
        myExpenses={myExpenses}
        recurringTransactions={recurring}
        monthlySummary={monthly}
        pendingApprovals={approvals}
      />
    </div>
  );
}
