import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const reconciliationStatusLabel: Record<string, string> = {
  unmatched: "未消込",
  partial: "一部消込",
  matched: "消込済",
  excluded: "対象外",
};

const reconciliationStatusColor: Record<string, string> = {
  unmatched: "bg-orange-100 text-orange-800 border-orange-200",
  partial: "bg-yellow-100 text-yellow-800 border-yellow-200",
  matched: "bg-green-100 text-green-800 border-green-200",
  excluded: "bg-gray-100 text-gray-600 border-gray-200",
};

export default async function AccountingTransactionsPage() {
  const transactions = await prisma.accountingTransaction.findMany({
    orderBy: { transactionDate: "desc" },
    take: 100,
    include: { importBatch: true, project: true },
  });

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">会計取引一覧</h1>

      <Card>
        <CardHeader>
          <CardTitle>取引データ</CardTitle>
        </CardHeader>
        <CardContent>
          {transactions.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              取引データがありません
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="px-3 py-2 font-medium">取引日</th>
                    <th className="px-3 py-2 font-medium">入出金</th>
                    <th className="px-3 py-2 font-medium text-right">金額</th>
                    <th className="px-3 py-2 font-medium">取引先名</th>
                    <th className="px-3 py-2 font-medium">摘要</th>
                    <th className="px-3 py-2 font-medium">口座名</th>
                    <th className="px-3 py-2 font-medium">ソース</th>
                    <th className="px-3 py-2 font-medium">消込状態</th>
                    <th className="px-3 py-2 font-medium">プロジェクト</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((tx) => (
                    <tr key={tx.id} className="border-b hover:bg-muted/50">
                      <td className="px-3 py-2 whitespace-nowrap">
                        {new Date(tx.transactionDate).toLocaleDateString(
                          "ja-JP"
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {tx.direction === "incoming" ? (
                          <span className="text-green-600 font-medium">
                            入金
                          </span>
                        ) : (
                          <span className="text-red-600 font-medium">出金</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">
                        ¥{tx.amount.toLocaleString()}
                      </td>
                      <td className="px-3 py-2">{tx.counterpartyName}</td>
                      <td className="px-3 py-2 max-w-[200px] truncate">
                        {tx.description ?? "-"}
                      </td>
                      <td className="px-3 py-2">
                        {tx.bankAccountName ?? "-"}
                      </td>
                      <td className="px-3 py-2">{tx.source}</td>
                      <td className="px-3 py-2">
                        <Badge
                          variant="outline"
                          className={
                            reconciliationStatusColor[
                              tx.reconciliationStatus
                            ] ?? ""
                          }
                        >
                          {reconciliationStatusLabel[
                            tx.reconciliationStatus
                          ] ?? tx.reconciliationStatus}
                        </Badge>
                      </td>
                      <td className="px-3 py-2">
                        {tx.project?.name ?? "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
