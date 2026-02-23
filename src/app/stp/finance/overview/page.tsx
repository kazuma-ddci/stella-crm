import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { getProjectDashboard } from "./actions";

const STATUS_COLORS: Record<string, string> = {
  // Transaction
  unconfirmed: "text-gray-600",
  confirmed: "text-blue-600",
  awaiting_accounting: "text-yellow-600",
  returned: "text-red-600",
  resubmitted: "text-orange-600",
  journalized: "text-indigo-600",
  partially_paid: "text-purple-600",
  paid: "text-green-600",
  hidden: "text-gray-400",
  // InvoiceGroup
  draft: "text-gray-600",
  pdf_created: "text-blue-600",
  sent: "text-cyan-600",
  corrected: "text-gray-400",
  // PaymentGroup
  before_request: "text-gray-600",
  requested: "text-blue-600",
  invoice_received: "text-cyan-600",
  rejected: "text-red-600",
  re_requested: "text-orange-600",
};

const TRANSACTION_STATUS_LABELS: Record<string, string> = {
  unconfirmed: "未確定",
  confirmed: "確定済み",
  awaiting_accounting: "経理処理待ち",
  returned: "差し戻し",
  resubmitted: "再提出",
  journalized: "仕訳済み",
  partially_paid: "一部入金/支払",
  paid: "完了",
  hidden: "非表示",
};

const ENTITY_TYPE_LABELS: Record<string, string> = {
  transaction: "取引",
  invoice_group: "請求",
  payment_group: "支払",
};

const ENTITY_TYPE_COLORS: Record<string, string> = {
  transaction: "bg-blue-100 text-blue-700",
  invoice_group: "bg-green-100 text-green-700",
  payment_group: "bg-orange-100 text-orange-700",
};

export default async function FinanceDashboardPage() {
  const data = await getProjectDashboard();
  const { transactionSummary, invoiceGroupSummary, paymentGroupSummary, recentActivities, monthlyTrends } = data;

  const grossProfit = transactionSummary.revenueTotal - transactionSummary.expenseTotal;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">STP 経理ダッシュボード</h1>

      {/* 全体サマリー */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">売上合計（税込）</div>
            <div className="text-2xl font-bold">
              ¥{transactionSummary.revenueTotal.toLocaleString()}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {transactionSummary.revenueCount}件
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">経費合計（税込）</div>
            <div className="text-2xl font-bold">
              ¥{transactionSummary.expenseTotal.toLocaleString()}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {transactionSummary.expenseCount}件
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">粗利</div>
            <div className={`text-2xl font-bold ${grossProfit >= 0 ? "text-green-600" : "text-red-600"}`}>
              ¥{grossProfit.toLocaleString()}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">取引総数</div>
            <div className="text-2xl font-bold">
              {transactionSummary.revenueCount + transactionSummary.expenseCount}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 月別推移 */}
      <Card>
        <CardHeader>
          <CardTitle>月別推移（直近6ヶ月）</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="py-2 text-left font-medium">月</th>
                  {monthlyTrends.map((m) => (
                    <th key={m.month} className="py-2 text-right font-medium">
                      {m.month}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr className="border-b">
                  <td className="py-2 font-medium">売上</td>
                  {monthlyTrends.map((m) => (
                    <td key={m.month} className="py-2 text-right">
                      ¥{m.revenue.toLocaleString()}
                    </td>
                  ))}
                </tr>
                <tr className="border-b">
                  <td className="py-2 font-medium">経費</td>
                  {monthlyTrends.map((m) => (
                    <td key={m.month} className="py-2 text-right">
                      ¥{m.expense.toLocaleString()}
                    </td>
                  ))}
                </tr>
                <tr className="border-b font-bold">
                  <td className="py-2">粗利</td>
                  {monthlyTrends.map((m) => (
                    <td
                      key={m.month}
                      className={`py-2 text-right ${m.profit >= 0 ? "text-green-600" : "text-red-600"}`}
                    >
                      ¥{m.profit.toLocaleString()}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* 取引ステータス・請求状況・支払状況 */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {/* 取引ステータス別 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              取引ステータス
              <Link
                href="/stp/finance/transactions"
                className="text-sm font-normal text-blue-600 hover:underline"
              >
                詳細 →
              </Link>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              {transactionSummary.byStatus.length === 0 ? (
                <p className="text-muted-foreground">取引データなし</p>
              ) : (
                transactionSummary.byStatus
                  .sort((a, b) => b.count - a.count)
                  .map((item) => (
                    <div key={item.status} className="flex justify-between">
                      <span className={STATUS_COLORS[item.status] ?? "text-gray-600"}>
                        {TRANSACTION_STATUS_LABELS[item.status] ?? item.status}
                      </span>
                      <span className="font-medium">{item.count}件</span>
                    </div>
                  ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* 請求状況 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              請求状況
              <Link
                href="/stp/finance/invoices"
                className="text-sm font-normal text-blue-600 hover:underline"
              >
                詳細 →
              </Link>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              {invoiceGroupSummary.total === 0 ? (
                <p className="text-muted-foreground">請求グループなし</p>
              ) : (
                <>
                  <div className="flex justify-between mb-3">
                    <span className="text-muted-foreground">合計</span>
                    <span className="font-bold">{invoiceGroupSummary.total}件</span>
                  </div>
                  {invoiceGroupSummary.byStatus
                    .sort((a, b) => b.count - a.count)
                    .map((item) => (
                      <div key={item.status} className="flex justify-between">
                        <span className={STATUS_COLORS[item.status] ?? "text-gray-600"}>
                          {item.label}
                        </span>
                        <span className="font-medium">{item.count}件</span>
                      </div>
                    ))}
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* 支払状況 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              支払状況
              <Link
                href="/stp/finance/payment-groups"
                className="text-sm font-normal text-blue-600 hover:underline"
              >
                詳細 →
              </Link>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              {paymentGroupSummary.total === 0 ? (
                <p className="text-muted-foreground">支払グループなし</p>
              ) : (
                <>
                  <div className="flex justify-between mb-3">
                    <span className="text-muted-foreground">合計</span>
                    <span className="font-bold">{paymentGroupSummary.total}件</span>
                  </div>
                  {paymentGroupSummary.byStatus
                    .sort((a, b) => b.count - a.count)
                    .map((item) => (
                      <div key={item.status} className="flex justify-between">
                        <span className={STATUS_COLORS[item.status] ?? "text-gray-600"}>
                          {item.label}
                        </span>
                        <span className="font-medium">{item.count}件</span>
                      </div>
                    ))}
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 直近のアクティビティ */}
      <Card>
        <CardHeader>
          <CardTitle>直近のアクティビティ</CardTitle>
        </CardHeader>
        <CardContent>
          {recentActivities.length === 0 ? (
            <p className="text-sm text-muted-foreground">アクティビティなし</p>
          ) : (
            <div className="space-y-3">
              {recentActivities.map((activity) => (
                <div
                  key={`${activity.entityType}-${activity.entityId}`}
                  className="flex items-center justify-between border-b pb-3 last:border-b-0 last:pb-0"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                        ENTITY_TYPE_COLORS[activity.entityType] ?? "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {ENTITY_TYPE_LABELS[activity.entityType] ?? activity.entityType}
                    </span>
                    <div className="min-w-0">
                      <div className="text-sm truncate">{activity.description}</div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(activity.createdAt).toLocaleDateString("ja-JP")} ・ {activity.status}
                      </div>
                    </div>
                  </div>
                  {activity.amount != null && (
                    <span className="text-sm font-medium shrink-0 ml-3">
                      ¥{activity.amount.toLocaleString()}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
