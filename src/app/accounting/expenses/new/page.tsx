import {
  getExpenseFormData,
  getMyExpenses,
  getAllRecurringTransactions,
  getMonthlyExpenseSummary,
} from "./actions";
import { ExpensePageClient } from "./expense-page-client";
import { prisma } from "@/lib/prisma";

export default async function AccountingExpenseNewPage() {
  const accountingProject = await prisma.masterProject.findFirst({
    where: { code: "accounting" },
    select: { id: true },
  });
  const projectId = accountingProject?.id ?? 0;

  const [formData, myExpenses, recurring, monthly] = await Promise.all([
    getExpenseFormData(null),
    getMyExpenses(projectId),
    getAllRecurringTransactions(),
    getMonthlyExpenseSummary(projectId),
  ]);

  return (
    <div className="p-6 pb-0 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">経費追加</h1>
        <p className="text-sm text-muted-foreground mt-1">
          経費を直接登録します。登録後は「仕訳待ち」状態になります。
        </p>
      </div>
      <ExpensePageClient
        formData={formData}
        mode="accounting"
        backUrl="/accounting/expenses/new"
        myExpenses={myExpenses}
        recurringTransactions={recurring}
        monthlySummary={monthly}
        pendingApprovals={[]}
        showProject
      />
    </div>
  );
}
