"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  Wallet,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import type { CashflowForecastData } from "./actions";

type Props = {
  data: CashflowForecastData;
  forecastDays: number;
};

function formatCurrency(amount: number): string {
  return amount.toLocaleString("ja-JP");
}

function formatDate(dateStr: string): string {
  const [, m, d] = dateStr.split("-");
  return `${Number(m)}/${Number(d)}`;
}

function formatDateFull(dateStr: string): string {
  const [y, m, d] = dateStr.split("-");
  return `${y}/${Number(m)}/${Number(d)}`;
}

const SOURCE_LABELS: Record<string, string> = {
  invoice: "請求書",
  transaction: "取引",
  recurring: "定期取引",
  credit_card: "クレカ引落",
};

// チャート用の色パレット
const CHART_COLORS = [
  "#2563eb", // blue-600
  "#16a34a", // green-600
  "#ea580c", // orange-600
  "#9333ea", // purple-600
  "#dc2626", // red-600
  "#0891b2", // cyan-600
];

export function CashflowClient({ data, forecastDays }: Props) {
  const router = useRouter();
  const [selectedDays, setSelectedDays] = useState(forecastDays.toString());

  const handleDaysChange = (days: string) => {
    setSelectedDays(days);
    router.push(`/accounting/cashflow?days=${days}`);
  };

  // 入金・出金の合計
  const totals = useMemo(() => {
    const incoming = data.forecastItems
      .filter((item) => item.type === "incoming")
      .reduce((sum, item) => sum + item.amount, 0);
    const outgoing = data.forecastItems
      .filter((item) => item.type === "outgoing")
      .reduce((sum, item) => sum + item.amount, 0);
    return { incoming, outgoing, net: incoming - outgoing };
  }, [data.forecastItems]);

  // チャートデータ（7日おきに間引き、ただし最初と最後は含める）
  const chartData = useMemo(() => {
    const dailyBalances = data.dailyBalances;
    if (dailyBalances.length === 0) return [];

    const step = Math.max(1, Math.floor(dailyBalances.length / 30));
    const result: Array<Record<string, string | number>> = [];

    for (let i = 0; i < dailyBalances.length; i++) {
      if (i === 0 || i === dailyBalances.length - 1 || i % step === 0) {
        const day = dailyBalances[i];
        const entry: Record<string, string | number> = {
          date: formatDate(day.date),
          dateFull: day.date,
          合計: day.totalBalance,
        };
        for (const pm of data.paymentMethods) {
          entry[pm.name] = day.balances[pm.id] ?? 0;
        }
        result.push(entry);
      }
    }

    return result;
  }, [data.dailyBalances, data.paymentMethods]);

  // 入金・出金アイテムの分離
  const incomingItems = data.forecastItems.filter(
    (item) => item.type === "incoming"
  );
  const outgoingItems = data.forecastItems.filter(
    (item) => item.type === "outgoing"
  );

  return (
    <div className="space-y-6">
      {/* フィルター */}
      <div className="flex flex-wrap gap-4 items-end">
        <div>
          <Label className="text-xs text-muted-foreground">予測期間</Label>
          <Select value={selectedDays} onValueChange={handleDaysChange}>
            <SelectTrigger className="w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="30">30日間</SelectItem>
              <SelectItem value="60">60日間</SelectItem>
              <SelectItem value="90">90日間</SelectItem>
              <SelectItem value="180">180日間</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* アラート */}
      {data.alerts.length > 0 && (
        <Card className="border-red-200 bg-red-50">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-red-700">
              <AlertTriangle className="h-5 w-5" />
              残高アラート
              <Badge variant="destructive">{data.alerts.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {data.alerts.map((alert) => (
                <div
                  key={`${alert.paymentMethodId}-${alert.date}`}
                  className="flex items-center justify-between text-sm py-1 border-b border-red-200 last:border-b-0"
                >
                  <span className="text-red-800 font-medium">
                    {alert.paymentMethodName}
                  </span>
                  <div className="text-right">
                    <div className="text-red-700">
                      {formatDateFull(alert.date)}に
                      ¥{formatCurrency(alert.projectedBalance)}まで低下見込み
                    </div>
                    <div className="text-xs text-red-500">
                      閾値: ¥{formatCurrency(alert.threshold)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* サマリーカード */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* 現在残高合計 */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Wallet className="h-4 w-4 text-blue-600" />
              <span className="text-sm text-muted-foreground">
                現在残高合計
              </span>
            </div>
            <div className="text-2xl font-bold mt-1">
              ¥
              {formatCurrency(
                data.paymentMethods.reduce(
                  (sum, pm) => sum + pm.currentBalance,
                  0
                )
              )}
            </div>
          </CardContent>
        </Card>

        {/* 入金予定 */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <ArrowUpRight className="h-4 w-4 text-green-600" />
              <span className="text-sm text-muted-foreground">
                入金予定合計
              </span>
            </div>
            <div className="text-2xl font-bold text-green-600 mt-1">
              ¥{formatCurrency(totals.incoming)}
            </div>
          </CardContent>
        </Card>

        {/* 出金予定 */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <ArrowDownRight className="h-4 w-4 text-red-600" />
              <span className="text-sm text-muted-foreground">
                出金予定合計
              </span>
            </div>
            <div className="text-2xl font-bold text-red-600 mt-1">
              ¥{formatCurrency(totals.outgoing)}
            </div>
          </CardContent>
        </Card>

        {/* 差引 */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              {totals.net >= 0 ? (
                <TrendingUp className="h-4 w-4 text-blue-600" />
              ) : (
                <TrendingDown className="h-4 w-4 text-red-600" />
              )}
              <span className="text-sm text-muted-foreground">差引</span>
            </div>
            <div
              className={`text-2xl font-bold mt-1 ${
                totals.net >= 0 ? "text-blue-600" : "text-red-600"
              }`}
            >
              {totals.net >= 0 ? "+" : ""}¥{formatCurrency(totals.net)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 口座別現在残高 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle>口座別残高</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {data.paymentMethods.map((pm) => (
              <div
                key={pm.id}
                className="flex items-center justify-between p-3 border rounded-lg"
              >
                <div>
                  <div className="text-sm font-medium">{pm.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {pm.methodType === "bank_account"
                      ? "銀行口座"
                      : pm.methodType === "credit_card"
                        ? "クレジットカード"
                        : pm.methodType === "cash"
                          ? "現金"
                          : "暗号資産"}
                  </div>
                </div>
                <div className="text-right">
                  <div
                    className={`text-lg font-semibold ${
                      pm.balanceAlertThreshold != null &&
                      pm.currentBalance < pm.balanceAlertThreshold
                        ? "text-red-600"
                        : ""
                    }`}
                  >
                    ¥{formatCurrency(pm.currentBalance)}
                  </div>
                  {pm.balanceAlertThreshold != null && (
                    <div className="text-xs text-muted-foreground">
                      閾値: ¥{formatCurrency(pm.balanceAlertThreshold)}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {data.paymentMethods.length === 0 && (
              <p className="text-sm text-muted-foreground col-span-full">
                残高管理対象の決済手段がありません
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 残高推移グラフ */}
      {chartData.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle>日別残高推移</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 12 }}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    tick={{ fontSize: 12 }}
                    tickFormatter={(value: number) =>
                      `¥${(value / 10000).toFixed(0)}万`
                    }
                  />
                  <Tooltip
                    formatter={(value, name) => [
                      `¥${formatCurrency(Number(value ?? 0))}`,
                      name,
                    ]}
                    labelFormatter={(label) => String(label)}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="合計"
                    stroke="#1e293b"
                    strokeWidth={2}
                    dot={false}
                  />
                  {data.paymentMethods.map((pm, i) => (
                    <Line
                      key={pm.id}
                      type="monotone"
                      dataKey={pm.name}
                      stroke={CHART_COLORS[i % CHART_COLORS.length]}
                      strokeWidth={1}
                      dot={false}
                      strokeDasharray="5 5"
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 入金予定テーブル */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <ArrowUpRight className="h-5 w-5 text-green-600" />
            入金予定
            <Badge variant="secondary">{incomingItems.length}件</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {incomingItems.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              期間内の入金予定はありません
            </p>
          ) : (
            <div className="border rounded-lg overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[120px]">日付</TableHead>
                    <TableHead className="w-[100px]">区分</TableHead>
                    <TableHead>内容</TableHead>
                    <TableHead>入金先</TableHead>
                    <TableHead className="text-right w-[150px]">
                      金額
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {incomingItems.map((item, index) => (
                    <TableRow key={`in-${index}`}>
                      <TableCell>{formatDateFull(item.date)}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {SOURCE_LABELS[item.source]}
                        </Badge>
                      </TableCell>
                      <TableCell>{item.description}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {item.paymentMethodName ?? "-"}
                      </TableCell>
                      <TableCell className="text-right font-medium text-green-600">
                        ¥{formatCurrency(item.amount)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 出金予定テーブル */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <ArrowDownRight className="h-5 w-5 text-red-600" />
            出金予定
            <Badge variant="secondary">{outgoingItems.length}件</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {outgoingItems.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              期間内の出金予定はありません
            </p>
          ) : (
            <div className="border rounded-lg overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[120px]">日付</TableHead>
                    <TableHead className="w-[100px]">区分</TableHead>
                    <TableHead>内容</TableHead>
                    <TableHead>出金元</TableHead>
                    <TableHead className="text-right w-[150px]">
                      金額
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {outgoingItems.map((item, index) => (
                    <TableRow key={`out-${index}`}>
                      <TableCell>{formatDateFull(item.date)}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {SOURCE_LABELS[item.source]}
                        </Badge>
                      </TableCell>
                      <TableCell>{item.description}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {item.paymentMethodName ?? "-"}
                      </TableCell>
                      <TableCell className="text-right font-medium text-red-600">
                        ¥{formatCurrency(item.amount)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
