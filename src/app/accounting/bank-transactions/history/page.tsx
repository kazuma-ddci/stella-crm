import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getTransactionHistory, getHistoryFilterOptions } from "./actions";
import { HistoryTable } from "./history-table";

export default async function TransactionHistoryPage() {
  const [transactions, filterOptions] = await Promise.all([
    getTransactionHistory(),
    getHistoryFilterOptions(),
  ]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">入出金履歴</h1>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>取引履歴</CardTitle>
        </CardHeader>
        <CardContent>
          <HistoryTable
            initialTransactions={transactions}
            filterOptions={filterOptions}
          />
        </CardContent>
      </Card>
    </div>
  );
}
