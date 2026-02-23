import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getBankTransactions, getBankTransactionFormData } from "./actions";
import { BankTransactionsTable } from "./bank-transactions-table";

export default async function BankTransactionsPage() {
  const [transactions, formData] = await Promise.all([
    getBankTransactions(),
    getBankTransactionFormData(),
  ]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">入出金管理</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>入出金一覧</CardTitle>
        </CardHeader>
        <CardContent>
          <BankTransactionsTable
            transactions={transactions}
            formData={formData}
          />
        </CardContent>
      </Card>
    </div>
  );
}
