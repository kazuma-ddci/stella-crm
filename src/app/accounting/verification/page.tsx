import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function AccountingVerificationPage() {
  const verifications = await prisma.accountingVerification.findMany({
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    include: {
      transaction: true,
      verifier: true,
    },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">確認管理</h1>

      <Card>
        <CardHeader>
          <CardTitle>確認一覧</CardTitle>
        </CardHeader>
        <CardContent>
          {verifications.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              確認データがありません
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="px-3 py-2 font-medium">取引日</th>
                    <th className="px-3 py-2 font-medium">取引先名</th>
                    <th className="px-3 py-2 font-medium text-right">金額</th>
                    <th className="px-3 py-2 font-medium">確認種別</th>
                    <th className="px-3 py-2 font-medium">ステータス</th>
                    <th className="px-3 py-2 font-medium">確認者</th>
                    <th className="px-3 py-2 font-medium">確認日時</th>
                    <th className="px-3 py-2 font-medium">差し戻し理由</th>
                  </tr>
                </thead>
                <tbody>
                  {verifications.map((v) => (
                    <tr key={v.id} className="border-b last:border-b-0">
                      <td className="px-3 py-2 whitespace-nowrap">
                        {v.transaction.transactionDate.toLocaleDateString(
                          "ja-JP"
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {v.transaction.counterpartyName}
                      </td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">
                        ¥{v.transaction.amount.toLocaleString()}
                      </td>
                      <td className="px-3 py-2">
                        {v.verificationType === "project" ? (
                          <span className="text-blue-600 font-medium">
                            プロジェクト
                          </span>
                        ) : (
                          <span className="text-purple-600 font-medium">
                            経理
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {v.status === "pending" ? (
                          <span className="text-yellow-600 font-medium">
                            未確認
                          </span>
                        ) : v.status === "verified" ? (
                          <span className="text-green-600 font-medium">
                            確認済
                          </span>
                        ) : (
                          <span className="text-red-600 font-medium">
                            差し戻し
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {v.verifier?.name || "-"}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {v.verifiedAt
                          ? v.verifiedAt.toLocaleString("ja-JP")
                          : "-"}
                      </td>
                      <td className="px-3 py-2">
                        {v.flagReason || "-"}
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
