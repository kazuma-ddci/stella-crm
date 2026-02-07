import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";

export default async function AccountingDashboardPage() {
  const [
    totalCount,
    unmatchedCount,
    partialCount,
    matchedCount,
    pendingVerifications,
    flaggedVerifications,
    recentBatches,
  ] = await Promise.all([
    prisma.accountingTransaction.count(),
    prisma.accountingTransaction.count({
      where: { reconciliationStatus: "unmatched" },
    }),
    prisma.accountingTransaction.count({
      where: { reconciliationStatus: "partial" },
    }),
    prisma.accountingTransaction.count({
      where: { reconciliationStatus: "matched" },
    }),
    prisma.accountingVerification.count({
      where: { status: "pending" },
    }),
    prisma.accountingVerification.count({
      where: { status: "flagged" },
    }),
    prisma.accountingImportBatch.findMany({
      take: 5,
      orderBy: { importedAt: "desc" },
      include: { importer: true },
    }),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">経理ダッシュボード</h1>

      {/* 消込サマリー */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">全取引件数</div>
            <div className="text-2xl font-bold">
              {totalCount.toLocaleString()}件
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">未消込</div>
            <div className="text-2xl font-bold text-orange-600">
              {unmatchedCount.toLocaleString()}件
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">一部消込</div>
            <div className="text-2xl font-bold text-yellow-600">
              {partialCount.toLocaleString()}件
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">消込済</div>
            <div className="text-2xl font-bold text-green-600">
              {matchedCount.toLocaleString()}件
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 確認状況・直近の取込 */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* 確認状況 */}
        <Card>
          <CardHeader>
            <CardTitle>確認状況</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">未確認件数</span>
                <span
                  className={`font-medium ${
                    pendingVerifications > 0 ? "text-orange-600" : ""
                  }`}
                >
                  {pendingVerifications}件
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">差し戻し件数</span>
                <span
                  className={`font-medium ${
                    flaggedVerifications > 0 ? "text-red-600" : ""
                  }`}
                >
                  {flaggedVerifications}件
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 直近の取込 */}
        <Card>
          <CardHeader>
            <CardTitle>直近の取込</CardTitle>
          </CardHeader>
          <CardContent>
            {recentBatches.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                取込履歴はありません
              </p>
            ) : (
              <div className="space-y-3">
                {recentBatches.map((batch) => (
                  <div
                    key={batch.id}
                    className="flex items-center justify-between border-b pb-2 last:border-b-0 last:pb-0"
                  >
                    <div>
                      <div className="text-sm font-medium">
                        {batch.source}
                        {batch.sourceService
                          ? ` (${batch.sourceService})`
                          : ""}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {batch.importedAt.toLocaleDateString("ja-JP")} -{" "}
                        {batch.importer.name}
                      </div>
                    </div>
                    <div className="text-right text-sm">
                      <span className="font-medium">
                        {batch.newCount}件
                      </span>
                      <span className="text-muted-foreground"> 取込</span>
                      {batch.duplicateCount > 0 && (
                        <div className="text-xs text-muted-foreground">
                          ({batch.duplicateCount}件 重複スキップ)
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
