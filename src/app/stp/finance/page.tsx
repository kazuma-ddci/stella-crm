import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { GenerateMonthlyButton } from "./generate-monthly-button";
import { calcTotalWithTax } from "@/lib/finance/auto-generate";

export default async function FinanceDashboardPage() {
  // 当月初日を計算
  const now = new Date();
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [revenueRecords, expenseRecords, invoices, unmatchedIncoming, unmatchedOutgoing, monthlyClose] = await Promise.all([
    prisma.stpRevenueRecord.findMany({
      where: { deletedAt: null },
      include: {
        stpCompany: { include: { company: true } },
      },
    }),
    prisma.stpExpenseRecord.findMany({
      where: { deletedAt: null },
      include: {
        agent: { include: { company: true } },
      },
    }),
    prisma.stpInvoice.findMany({
      where: { deletedAt: null },
    }),
    // 未消込入金件数
    prisma.stpPaymentTransaction.count({
      where: { deletedAt: null, status: "unmatched", direction: "incoming" },
    }),
    // 未消込出金件数
    prisma.stpPaymentTransaction.count({
      where: { deletedAt: null, status: "unmatched", direction: "outgoing" },
    }),
    // 当月の月次締めステータス
    prisma.stpMonthlyClose.findUnique({
      where: { targetMonth: currentMonthStart },
    }),
  ]);

  // 全体サマリー（税込合計で集計）
  const totalRevenue = revenueRecords.reduce(
    (sum, r) => sum + calcTotalWithTax(r.expectedAmount, r.taxType, r.taxRate),
    0
  );
  const totalRevenueCollected = revenueRecords
    .filter((r) => r.status === "paid")
    .reduce((sum, r) => sum + (r.paidAmount || calcTotalWithTax(r.expectedAmount, r.taxType, r.taxRate)), 0);
  const totalExpense = expenseRecords.reduce(
    (sum, r) => sum + calcTotalWithTax(r.expectedAmount, r.taxType, r.taxRate),
    0
  );
  const totalExpensePaid = expenseRecords
    .filter((r) => r.status === "paid")
    .reduce((sum, r) => sum + (r.paidAmount || calcTotalWithTax(r.expectedAmount, r.taxType, r.taxRate)), 0);
  const grossProfit = totalRevenueCollected - totalExpensePaid;

  // 月別集計（直近6ヶ月）
  const months: { label: string; key: string }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = d.toISOString().split("T")[0];
    const label = `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}`;
    months.push({ label, key });
  }

  const monthlyData = months.map((m) => {
    const monthRevenue = revenueRecords
      .filter((r) => {
        const tm = r.targetMonth.toISOString().split("T")[0];
        return tm === m.key;
      })
      .reduce((sum, r) => sum + calcTotalWithTax(r.expectedAmount, r.taxType, r.taxRate), 0);

    const monthExpense = expenseRecords
      .filter((r) => {
        const tm = r.targetMonth.toISOString().split("T")[0];
        return tm === m.key;
      })
      .reduce((sum, r) => sum + calcTotalWithTax(r.expectedAmount, r.taxType, r.taxRate), 0);

    return {
      month: m.label,
      revenue: monthRevenue,
      expense: monthExpense,
      profit: monthRevenue - monthExpense,
    };
  });

  // ステータス別
  const revenueByStatus = {
    pending: revenueRecords.filter((r) => r.status === "pending").length,
    invoiced: revenueRecords.filter((r) => r.status === "invoiced").length,
    paid: revenueRecords.filter((r) => r.status === "paid").length,
    overdue: revenueRecords.filter((r) => r.status === "overdue").length,
  };

  const expenseByStatus = {
    pending: expenseRecords.filter((r) => r.status === "pending").length,
    approved: expenseRecords.filter((r) => r.status === "approved").length,
    paid: expenseRecords.filter((r) => r.status === "paid").length,
  };

  // 会計同期状況
  const revenueAccounting = {
    unprocessed: revenueRecords.filter((r) => r.accountingStatus === "unprocessed").length,
    processed: revenueRecords.filter((r) => r.accountingStatus === "processed").length,
  };
  const expenseAccounting = {
    unprocessed: expenseRecords.filter((r) => r.accountingStatus === "unprocessed").length,
    processed: expenseRecords.filter((r) => r.accountingStatus === "processed").length,
  };

  // 請求書サマリー
  const outgoingInvoices = invoices.filter((i) => i.direction === "outgoing");
  const incomingInvoices = invoices.filter((i) => i.direction === "incoming");
  const outgoingUnpaid = outgoingInvoices.filter((i) => i.status !== "paid").length;
  const incomingUnpaid = incomingInvoices.filter((i) => i.status !== "paid").length;

  // 売掛金アラート: 30日超の未入金件数
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const overdueOver30Days = revenueRecords.filter((r) => {
    if (r.status === "paid" || r.status === "cancelled") return false;
    const dueDate = r.dueDate || r.invoiceDate;
    if (!dueDate) return false;
    return dueDate < thirtyDaysAgo;
  }).length;

  // 月次締めステータス
  const isMonthClosed = monthlyClose != null && monthlyClose.reopenedAt == null;
  const monthlyCloseLabel = currentMonthStart.toLocaleDateString("ja-JP", { year: "numeric", month: "long" });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">売上・経費ダッシュボード</h1>
        <GenerateMonthlyButton />
      </div>

      {/* 全体サマリー */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-5">
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">売上総額</div>
            <div className="text-2xl font-bold">
              ¥{totalRevenue.toLocaleString()}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">入金済</div>
            <div className="text-2xl font-bold text-green-600">
              ¥{totalRevenueCollected.toLocaleString()}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">経費総額</div>
            <div className="text-2xl font-bold">
              ¥{totalExpense.toLocaleString()}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">支払済</div>
            <div className="text-2xl font-bold text-orange-600">
              ¥{totalExpensePaid.toLocaleString()}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">粗利（実績）</div>
            <div
              className={`text-2xl font-bold ${grossProfit >= 0 ? "text-green-600" : "text-red-600"}`}
            >
              ¥{grossProfit.toLocaleString()}
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
                  {monthlyData.map((m) => (
                    <th
                      key={m.month}
                      className="py-2 text-right font-medium"
                    >
                      {m.month}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr className="border-b">
                  <td className="py-2 font-medium">売上</td>
                  {monthlyData.map((m) => (
                    <td key={m.month} className="py-2 text-right">
                      ¥{m.revenue.toLocaleString()}
                    </td>
                  ))}
                </tr>
                <tr className="border-b">
                  <td className="py-2 font-medium">経費</td>
                  {monthlyData.map((m) => (
                    <td key={m.month} className="py-2 text-right">
                      ¥{m.expense.toLocaleString()}
                    </td>
                  ))}
                </tr>
                <tr className="border-b font-bold">
                  <td className="py-2">粗利</td>
                  {monthlyData.map((m) => (
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

      {/* 消込状況・月次締め・売掛金アラート */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {/* 消込状況サマリー */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              消込状況
              <Link
                href="/stp/finance/payments"
                className="text-sm font-normal text-blue-600 hover:underline"
              >
                詳細 →
              </Link>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">未消込入金</span>
                <span className={`font-medium ${unmatchedIncoming > 0 ? "text-orange-600" : ""}`}>
                  {unmatchedIncoming}件
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">未消込出金</span>
                <span className={`font-medium ${unmatchedOutgoing > 0 ? "text-orange-600" : ""}`}>
                  {unmatchedOutgoing}件
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 月次締めステータス */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              月次締め
              <Link
                href="/stp/finance/monthly-close"
                className="text-sm font-normal text-blue-600 hover:underline"
              >
                詳細 →
              </Link>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">{monthlyCloseLabel}</span>
                <span
                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                    isMonthClosed
                      ? "bg-green-100 text-green-700"
                      : "bg-yellow-100 text-yellow-700"
                  }`}
                >
                  {isMonthClosed ? "締め済" : "未締め"}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 売掛金アラート */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              売掛金アラート
              <Link
                href="/stp/finance/aging"
                className="text-sm font-normal text-blue-600 hover:underline"
              >
                詳細 →
              </Link>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">30日超 未入金</span>
                <span className={`font-medium ${overdueOver30Days > 0 ? "text-red-600" : "text-green-600"}`}>
                  {overdueOver30Days}件
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ステータス・会計同期・請求書 */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {/* 売上ステータス */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              売上ステータス
              <Link
                href="/stp/finance/revenue"
                className="text-sm font-normal text-blue-600 hover:underline"
              >
                詳細 →
              </Link>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">未請求</span>
                <span className="font-medium">{revenueByStatus.pending}件</span>
              </div>
              <div className="flex justify-between">
                <span className="text-blue-600">請求済</span>
                <span className="font-medium">{revenueByStatus.invoiced}件</span>
              </div>
              <div className="flex justify-between">
                <span className="text-green-600">入金済</span>
                <span className="font-medium">{revenueByStatus.paid}件</span>
              </div>
              <div className="flex justify-between">
                <span className="text-red-600">期限超過</span>
                <span className="font-medium">{revenueByStatus.overdue}件</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 経費ステータス */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              経費ステータス
              <Link
                href="/stp/finance/expenses"
                className="text-sm font-normal text-blue-600 hover:underline"
              >
                詳細 →
              </Link>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">未承認</span>
                <span className="font-medium">{expenseByStatus.pending}件</span>
              </div>
              <div className="flex justify-between">
                <span className="text-blue-600">承認済</span>
                <span className="font-medium">{expenseByStatus.approved}件</span>
              </div>
              <div className="flex justify-between">
                <span className="text-green-600">支払済</span>
                <span className="font-medium">{expenseByStatus.paid}件</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 会計同期 + 請求書 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              会計処理 / 請求書
              <Link
                href="/stp/finance/invoices"
                className="text-sm font-normal text-blue-600 hover:underline"
              >
                請求書 →
              </Link>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="text-xs font-medium text-muted-foreground uppercase">会計処理</div>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">売上 未処理</span>
                  <span className="font-medium">{revenueAccounting.unprocessed}件</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">経費 未処理</span>
                  <span className="font-medium">{expenseAccounting.unprocessed}件</span>
                </div>
              </div>
              <div className="border-t pt-2">
                <div className="text-xs font-medium text-muted-foreground uppercase">請求書</div>
                <div className="mt-1 space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-blue-600">発行 未入金</span>
                    <span className="font-medium">{outgoingUnpaid}件</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-orange-600">受領 未処理</span>
                    <span className="font-medium">{incomingUnpaid}件</span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
