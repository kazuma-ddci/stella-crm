import { getTransactionFormData } from "@/app/finance/transactions/actions";
import { getAccountingTransactionFormData } from "../accounting-actions";
import { TransactionForm } from "@/app/finance/transactions/transaction-form";

type Props = {
  searchParams: Promise<{ mode?: string }>;
};

export default async function NewTransactionPage({ searchParams }: Props) {
  const params = await searchParams;
  const isAccountingMode = params.mode === "accounting";
  const formData = isAccountingMode
    ? await getAccountingTransactionFormData()
    : await getTransactionFormData();

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">
        {isAccountingMode ? "取引の新規作成（経理）" : "取引の新規作成"}
      </h1>
      {isAccountingMode && (
        <p className="text-sm text-muted-foreground">
          経理側から作成する取引です。作成後は自動的に「経理処理待ち」ステータスになります。
          既存の請求グループや支払グループに紐づけることもできます。
        </p>
      )}
      <TransactionForm formData={formData} accountingMode={isAccountingMode} />
    </div>
  );
}
