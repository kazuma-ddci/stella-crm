import { getExpenseFormData } from "./actions";
import { ManualExpenseForm } from "./manual-expense-form";

export default async function AccountingExpenseNewPage() {
  const formData = await getExpenseFormData(null);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">経費追加</h1>
        <p className="text-sm text-muted-foreground mt-1">
          経費を直接登録します。登録後は「仕訳待ち」状態になります。
        </p>
      </div>
      <ManualExpenseForm
        formData={formData}
        mode="accounting"
        backUrl="/accounting/workflow"
      />
    </div>
  );
}
