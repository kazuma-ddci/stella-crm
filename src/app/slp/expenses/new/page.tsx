import { getExpenseFormData } from "@/app/accounting/expenses/new/actions";
import { ManualExpenseForm } from "@/app/accounting/expenses/new/manual-expense-form";

export default async function SlpExpenseNewPage() {
  const formData = await getExpenseFormData("slp");

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">経費申請</h1>
        <p className="text-sm text-muted-foreground mt-1">
          経費を申請します。登録後は経理の承認を経て仕訳フローに進みます。
        </p>
      </div>
      <ManualExpenseForm
        formData={formData}
        mode="project"
        backUrl="/slp"
      />
    </div>
  );
}
