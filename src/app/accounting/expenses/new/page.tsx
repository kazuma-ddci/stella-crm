import { getManualExpenseFormData } from "./actions";
import { ManualExpenseForm } from "./manual-expense-form";

export default async function NewManualExpensePage() {
  const formData = await getManualExpenseFormData();

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">手動経費追加</h1>
        <p className="text-sm text-muted-foreground mt-1">
          CRMに紐づかない経費（会食・備品購入など）を登録します。
          登録後は「経理承認待ち」状態となり、経理の承認後に仕訳フローに進みます。
        </p>
      </div>
      <ManualExpenseForm formData={formData} />
    </div>
  );
}
