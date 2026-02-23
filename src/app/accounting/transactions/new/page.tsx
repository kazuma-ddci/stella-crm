import { getTransactionFormData } from "../actions";
import { TransactionForm } from "../transaction-form";

export default async function NewTransactionPage() {
  const formData = await getTransactionFormData();

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">取引の新規作成</h1>
      <TransactionForm formData={formData} />
    </div>
  );
}
