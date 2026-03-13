import Link from "next/link";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  FileText,
  Banknote,
  SplitSquareVertical,
  AlertTriangle,
  Clock,
  Wallet,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
  CircleDollarSign,
} from "lucide-react";
import { getDashboardData } from "./actions";

function formatCurrency(amount: number): string {
  return amount.toLocaleString("ja-JP");
}

function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString("ja-JP");
}

export default async function AccountingDashboardPage() {
  const data = await getDashboardData();

  const totalAlerts =
    data.alerts.balanceAlerts.length +
    data.alerts.overdueInvoices.length;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">経理ダッシュボード</h1>

      {/* 未処理件数カード */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Link href="/accounting/transactions?status=awaiting_accounting">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-orange-100 p-2">
                  <FileText className="h-5 w-5 text-orange-600" />
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">
                    未仕訳取引
                  </div>
                  <div className="text-2xl font-bold text-orange-600">
                    {data.pendingCounts.unjournalizedTransactions}
                    <span className="text-base font-normal">件</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/accounting/bank-transactions">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-blue-100 p-2">
                  <Banknote className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">
                    未消込入出金
                  </div>
                  <div className="text-2xl font-bold text-blue-600">
                    {data.pendingCounts.unreconciledBankTransactions}
                    <span className="text-base font-normal">件</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/accounting/transactions?allocation=unconfirmed">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-purple-100 p-2">
                  <SplitSquareVertical className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">
                    按分未確定
                  </div>
                  <div className="text-2xl font-bold text-purple-600">
                    {data.pendingCounts.unconfirmedAllocations}
                    <span className="text-base font-normal">件</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* アラート一覧 & 今月サマリー */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* アラート一覧 */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              アラート
              {totalAlerts > 0 && (
                <Badge variant="destructive">{totalAlerts}</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {totalAlerts === 0 ? (
              <p className="text-sm text-muted-foreground">
                アラートはありません
              </p>
            ) : (
              <div className="space-y-4">
                {/* 残高アラート */}
                {data.alerts.balanceAlerts.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-yellow-700 mb-2">
                      <Wallet className="h-4 w-4 inline mr-1" />
                      残高アラート（{data.alerts.balanceAlerts.length}件）
                    </h4>
                    <div className="space-y-1">
                      {data.alerts.balanceAlerts.map((alert) => (
                        <div
                          key={alert.paymentMethodId}
                          className="flex items-center justify-between text-sm py-1 border-b last:border-b-0"
                        >
                          <span className="text-gray-700">{alert.name}</span>
                          <span className="text-red-600 font-medium whitespace-nowrap">
                            ¥{formatCurrency(alert.currentBalance)} / 閾値
                            ¥{formatCurrency(alert.threshold)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 入金期限超過 */}
                {data.alerts.overdueInvoices.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-red-700 mb-2">
                      <Clock className="h-4 w-4 inline mr-1" />
                      入金期限超過（{data.alerts.overdueInvoices.length}件）
                    </h4>
                    <div className="space-y-1">
                      {data.alerts.overdueInvoices.map((alert) => (
                        <div
                          key={alert.invoiceGroupId}
                          className="flex items-center justify-between text-sm py-1 border-b last:border-b-0"
                        >
                          <div className="truncate mr-2">
                            <span className="text-gray-700">
                              {alert.counterpartyName}
                            </span>
                            {alert.invoiceNumber && (
                              <span className="text-xs text-gray-500 ml-1">
                                ({alert.invoiceNumber})
                              </span>
                            )}
                          </div>
                          <div className="text-right whitespace-nowrap">
                            <div className="text-red-600 font-medium">
                              期限: {formatDate(alert.paymentDueDate)}
                            </div>
                            {alert.totalAmount != null && (
                              <div className="text-xs text-gray-500">
                                ¥{formatCurrency(alert.totalAmount)}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* 今月サマリー */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle>今月サマリー</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between py-2 border-b">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-green-600" />
                  <span className="text-sm text-gray-600">売上</span>
                </div>
                <span className="text-lg font-semibold text-green-600">
                  ¥{formatCurrency(data.monthlySummary.revenue)}
                </span>
              </div>

              <div className="flex items-center justify-between py-2 border-b">
                <div className="flex items-center gap-2">
                  <TrendingDown className="h-4 w-4 text-red-600" />
                  <span className="text-sm text-gray-600">経費</span>
                </div>
                <span className="text-lg font-semibold text-red-600">
                  ¥{formatCurrency(data.monthlySummary.expense)}
                </span>
              </div>

              <div className="flex items-center justify-between py-2 border-b">
                <div className="flex items-center gap-2">
                  <ArrowUpRight className="h-4 w-4 text-blue-600" />
                  <span className="text-sm text-gray-600">入金</span>
                </div>
                <span className="text-lg font-semibold text-blue-600">
                  ¥{formatCurrency(data.monthlySummary.incoming)}
                </span>
              </div>

              <div className="flex items-center justify-between py-2 border-b">
                <div className="flex items-center gap-2">
                  <ArrowDownRight className="h-4 w-4 text-orange-600" />
                  <span className="text-sm text-gray-600">出金</span>
                </div>
                <span className="text-lg font-semibold text-orange-600">
                  ¥{formatCurrency(data.monthlySummary.outgoing)}
                </span>
              </div>

              <div className="flex items-center justify-between py-2">
                <div className="flex items-center gap-2">
                  <CircleDollarSign className="h-4 w-4 text-yellow-600" />
                  <span className="text-sm text-gray-600">未入金</span>
                </div>
                <span className="text-lg font-semibold text-yellow-600">
                  ¥{formatCurrency(data.monthlySummary.unpaidInvoices)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 遅延率KPI */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* 入金遅延 */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-blue-500" />
              入金遅延率
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">遅延率</span>
                <span className={`text-2xl font-bold ${data.delayMetrics.invoiceDelayRate > 0 ? "text-red-600" : "text-green-600"}`}>
                  {data.delayMetrics.invoiceDelayRate}%
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">
                  遅延 {data.delayMetrics.invoiceDelayCount}件 / 完了 {data.delayMetrics.invoiceTotalCompleted}件
                </span>
                {data.delayMetrics.invoiceAvgDelayDays > 0 && (
                  <span className="text-gray-500">
                    平均遅延: {data.delayMetrics.invoiceAvgDelayDays}日
                  </span>
                )}
              </div>
              {data.delayMetrics.invoiceOverdueCount > 0 && (
                <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
                  現在超過中: {data.delayMetrics.invoiceOverdueCount}件
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* 支払遅延 */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-orange-500" />
              支払遅延率
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">遅延率</span>
                <span className={`text-2xl font-bold ${data.delayMetrics.paymentDelayRate > 0 ? "text-red-600" : "text-green-600"}`}>
                  {data.delayMetrics.paymentDelayRate}%
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">
                  遅延 {data.delayMetrics.paymentDelayCount}件 / 完了 {data.delayMetrics.paymentTotalCompleted}件
                </span>
                {data.delayMetrics.paymentAvgDelayDays > 0 && (
                  <span className="text-gray-500">
                    平均遅延: {data.delayMetrics.paymentAvgDelayDays}日
                  </span>
                )}
              </div>
              {data.delayMetrics.paymentOverdueCount > 0 && (
                <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
                  現在超過中: {data.delayMetrics.paymentOverdueCount}件
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
