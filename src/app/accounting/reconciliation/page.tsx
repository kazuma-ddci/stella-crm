import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function AccountingReconciliationPage() {
  const [unmatchedTransactions, reconciliations] = await Promise.all([
    prisma.accountingTransaction.findMany({
      where: {
        reconciliationStatus: { in: ["unmatched", "partial"] },
      },
      orderBy: { transactionDate: "desc" },
      take: 100,
    }),
    prisma.accountingReconciliation.findMany({
      orderBy: { matchedAt: "desc" },
      take: 50,
      include: {
        transaction: true,
        revenueRecord: {
          include: {
            stpCompany: { include: { company: true } },
          },
        },
        expenseRecord: {
          include: {
            agent: { include: { company: true } },
          },
        },
        matcher: true,
      },
    }),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">消込管理</h1>

      {/* 未消込取引 */}
      <Card>
        <CardHeader>
          <CardTitle>未消込取引</CardTitle>
        </CardHeader>
        <CardContent>
          {unmatchedTransactions.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              未消込の取引はありません
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
                    <th className="px-3 py-2 font-medium">ソース</th>
                  </tr>
                </thead>
                <tbody>
                  {unmatchedTransactions.map((tx) => (
                    <tr key={tx.id} className="border-b last:border-b-0">
                      <td className="px-3 py-2 whitespace-nowrap">
                        {tx.transactionDate.toLocaleDateString("ja-JP")}
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
                      <td className="px-3 py-2">{tx.description || "-"}</td>
                      <td className="px-3 py-2">{tx.source}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 消込履歴 */}
      <Card>
        <CardHeader>
          <CardTitle>消込履歴</CardTitle>
        </CardHeader>
        <CardContent>
          {reconciliations.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              消込履歴はありません
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="px-3 py-2 font-medium">消込日</th>
                    <th className="px-3 py-2 font-medium">会計取引</th>
                    <th className="px-3 py-2 font-medium">紐付先</th>
                    <th className="px-3 py-2 font-medium text-right">
                      消込金額
                    </th>
                    <th className="px-3 py-2 font-medium">消込方法</th>
                    <th className="px-3 py-2 font-medium">担当者</th>
                  </tr>
                </thead>
                <tbody>
                  {reconciliations.map((rec) => {
                    const linkedCompanyName =
                      rec.revenueRecord?.stpCompany?.company?.name ||
                      rec.expenseRecord?.agent?.company?.name ||
                      "-";

                    return (
                      <tr key={rec.id} className="border-b last:border-b-0">
                        <td className="px-3 py-2 whitespace-nowrap">
                          {rec.matchedAt.toLocaleDateString("ja-JP")}
                        </td>
                        <td className="px-3 py-2">
                          {rec.transaction.counterpartyName}
                        </td>
                        <td className="px-3 py-2">{linkedCompanyName}</td>
                        <td className="px-3 py-2 text-right whitespace-nowrap">
                          ¥{rec.allocatedAmount.toLocaleString()}
                        </td>
                        <td className="px-3 py-2">
                          {rec.matchMethod === "auto" ? (
                            <span className="text-blue-600 font-medium">
                              自動
                            </span>
                          ) : (
                            <span className="text-gray-600 font-medium">
                              手動
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          {rec.matcher?.name || "-"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
