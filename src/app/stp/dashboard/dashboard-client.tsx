"use client";

import { MonthSelector } from "./month-selector";
import { KgiCard } from "./kgi-card";
import type {
  KgiCardData,
  FunnelData,
  LeadAcquisitionData,
  RevenueTrendData,
} from "./actions";
import type { DeptTabData } from "./dept-kpi-actions";
import { DeptKpiSection } from "./dept-kpi-section";
import { cn } from "@/lib/utils";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

type DashboardClientProps = {
  data: KgiCardData;
  months: string[];
  currentMonth: string;
  funnelData: FunnelData;
  leadData: LeadAcquisitionData;
  revenueTrendData: RevenueTrendData;
  deptKpiData: DeptTabData[];
};

/** 金額フォーマット: ¥1,300,000 → "¥130万" (万単位) / "¥1,300,000" (そのまま) */
function formatCurrencyMan(value: number): string {
  const absValue = Math.abs(value);
  if (absValue >= 10000) {
    const man = Math.round(absValue / 10000 * 10) / 10;
    const prefix = value < 0 ? "▲" : "¥";
    // 整数の場合は小数点なし
    const formatted = man % 1 === 0 ? String(man) : man.toFixed(1);
    return `${prefix}${formatted}万`;
  }
  const prefix = value < 0 ? "▲¥" : "¥";
  return `${prefix}${new Intl.NumberFormat("ja-JP").format(absValue)}`;
}

function getRevenueStatus(rate: number) {
  if (rate >= 100) return { status: "achieved" as const, label: "達成" };
  if (rate >= 80) return { status: "good" as const, label: "好調" };
  if (rate >= 50) return { status: "caution" as const, label: "注意" };
  return { status: "behind" as const, label: "未達" };
}

function getGrossProfitStatus(value: number) {
  if (value >= 0) return { status: "surplus" as const, label: "黒字" };
  return { status: "deficit" as const, label: "赤字" };
}

function getCustomerStatus(actual: number, prevMonth: number) {
  if (prevMonth === 0) {
    return actual > 0
      ? { status: "good" as const, label: "好調" }
      : { status: "caution" as const, label: "-" };
  }
  const change = ((actual - prevMonth) / prevMonth) * 100;
  if (change > 0) return { status: "good" as const, label: "好調" };
  if (change === 0) return { status: "caution" as const, label: "横ばい" };
  return { status: "behind" as const, label: "減少" };
}

function getContractStatus(rate: number) {
  if (rate >= 100) return { status: "achieved" as const, label: "達成" };
  if (rate >= 80) return { status: "good" as const, label: "好調" };
  if (rate >= 50) return { status: "caution" as const, label: "注意" };
  return { status: "behind" as const, label: "未達" };
}

// ファネルバーの色（グラデーション）
const FUNNEL_COLORS = [
  "bg-indigo-400",
  "bg-purple-400",
  "bg-violet-400",
  "bg-fuchsia-400",
  "bg-pink-400",
  "bg-rose-400",
];

function SalesFunnel({ data }: { data: FunnelData }) {
  const maxCount = Math.max(...data.stages.map((s) => s.companyCount), 1);

  return (
    <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
      <div className="p-5 sm:p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-5 flex items-center gap-2">
          <span className="text-red-500">▼</span>
          セールスファネル
        </h2>

        <div className="space-y-1">
          {data.stages.map((stage, i) => {
            const barColor = FUNNEL_COLORS[i % FUNNEL_COLORS.length];
            const widthPercent =
              maxCount > 0
                ? Math.max((stage.companyCount / maxCount) * 100, 4)
                : 4;

            return (
              <div key={stage.id}>
                {/* ステージ行 */}
                <div className="flex items-center gap-3 py-2">
                  <span className="text-sm text-gray-500 w-20 shrink-0 text-right">
                    {stage.name}
                  </span>
                  <div className="flex-1 flex items-center gap-3">
                    <div className="flex-1 relative h-9 bg-gray-50 rounded">
                      <div
                        className={cn(
                          "h-full rounded flex items-center px-3 transition-all",
                          barColor
                        )}
                        style={{ width: `${widthPercent}%` }}
                      >
                        <span className="text-white font-bold text-sm tabular-nums">
                          {stage.companyCount > 0
                            ? stage.companyCount
                            : "–"}
                        </span>
                      </div>
                    </div>
                    <span className="text-sm text-gray-500 tabular-nums w-12 text-right shrink-0">
                      {stage.companyCount > 0
                        ? `${stage.companyCount}件`
                        : "?件"}
                    </span>
                  </div>
                </div>

                {/* 転換率（最後のステージ以外） */}
                {i < data.conversions.length && (
                  <div className="flex items-center gap-3 py-0.5">
                    <div className="w-20 shrink-0" />
                    <div className="flex-1 flex items-center gap-2 px-1">
                      <span className="text-xs text-gray-400">
                        ↓ 転換率{" "}
                        {data.conversions[i].rate !== null
                          ? `${data.conversions[i].rate}%`
                          : "–%"}
                      </span>
                      {data.conversions[i].rate !== null &&
                        data.conversions[i].rate! < 20 && (
                          <span className="text-[10px] font-medium text-red-500 bg-red-50 px-1.5 py-0.5 rounded-full border border-red-200">
                            ボトルネック
                          </span>
                        )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/** 万単位でフォーマット */
function formatMan(value: number): string {
  const man = Math.round(value / 10000 * 10) / 10;
  return man % 1 === 0 ? `${man}万` : `${man.toFixed(1)}万`;
}

/** 億・万単位で金額フォーマット（年間サマリー用） */
function formatCurrencyCompact(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 100_000_000) {
    const oku = Math.round(abs / 1_000_000) / 100;
    return `¥${oku % 1 === 0 ? String(oku) : oku.toFixed(2)}億`;
  }
  if (abs >= 10_000) {
    const man = Math.round(abs / 10_000);
    return `¥${new Intl.NumberFormat("ja-JP").format(man)}万`;
  }
  return `¥${new Intl.NumberFormat("ja-JP").format(abs)}`;
}

function RevenueTrendChart({ data }: { data: RevenueTrendData }) {
  const chartData = data.months.map((m) => ({
    label: m.label,
    target: m.target,
    actual: m.actual,
    forecast: m.forecast,
  }));

  // 年間目標（全月のtargetの合計）
  const annualTarget = data.months.reduce(
    (sum, m) => sum + (m.target ?? 0),
    0
  );
  // 年間累計（実績の合計）
  const annualActual = data.months.reduce(
    (sum, m) => sum + (m.actual ?? 0),
    0
  );

  return (
    <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
      <div className="p-5 sm:p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-5 flex items-center gap-2">
          <span className="text-blue-500">📈</span>
          月次売上推移（計画 vs 実績）
        </h2>

        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={chartData}
              margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 12, fill: "#6b7280" }}
                axisLine={{ stroke: "#e5e7eb" }}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 12, fill: "#6b7280" }}
                axisLine={{ stroke: "#e5e7eb" }}
                tickLine={false}
                tickFormatter={(v: number) => formatMan(v)}
                width={60}
              />
              <Tooltip
                formatter={(value, name) => {
                  if (value == null) return ["-", String(name ?? "")];
                  const label =
                    name === "target"
                      ? "計画"
                      : name === "actual"
                        ? "実績"
                        : "着地予測";
                  return [`¥${formatMan(Number(value))}`, label];
                }}
                contentStyle={{
                  borderRadius: "8px",
                  border: "1px solid #e5e7eb",
                  fontSize: "13px",
                }}
              />
              <Legend
                formatter={(value: string) =>
                  value === "target"
                    ? "計画"
                    : value === "actual"
                      ? "実績"
                      : "着地予測"
                }
                iconType="line"
                wrapperStyle={{ fontSize: "13px" }}
              />
              <Line
                type="monotone"
                dataKey="target"
                stroke="#9ca3af"
                strokeDasharray="6 3"
                strokeWidth={2}
                dot={{ r: 3, fill: "#9ca3af" }}
                connectNulls
              />
              <Line
                type="monotone"
                dataKey="actual"
                stroke="#3b82f6"
                strokeWidth={2.5}
                dot={{ r: 4, fill: "#3b82f6" }}
                connectNulls
              />
              <Line
                type="monotone"
                dataKey="forecast"
                stroke="#f97316"
                strokeDasharray="6 3"
                strokeWidth={2}
                dot={{ r: 3, fill: "#f97316" }}
                connectNulls
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="text-xs text-gray-500 text-right mt-2">
          年間目標:{" "}
          <span className="font-medium text-gray-700 tabular-nums">
            {annualTarget > 0 ? formatCurrencyCompact(annualTarget) : "–"}
          </span>
          {" / "}
          年間累計:{" "}
          <span className="font-medium text-blue-600 tabular-nums">
            {formatCurrencyCompact(annualActual)}
          </span>
        </div>
      </div>
    </div>
  );
}

function LeadAcquisition({ data }: { data: LeadAcquisitionData }) {
  const achievementStatus =
    data.target > 0
      ? data.achievementRate >= 100
        ? "achieved"
        : data.achievementRate >= 80
          ? "good"
          : data.achievementRate >= 50
            ? "caution"
            : "behind"
      : "caution";

  const achievementColor = {
    achieved: "text-green-600 bg-green-50 border-green-200",
    good: "text-green-600 bg-green-50 border-green-200",
    caution: "text-yellow-600 bg-yellow-50 border-yellow-200",
    behind: "text-red-600 bg-red-50 border-red-200",
  }[achievementStatus];

  return (
    <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
      <div className="p-5 sm:p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-5 flex items-center gap-2">
          <span>📊</span>
          リード獲得 予実管理 & 代理店ROI
        </h2>

        {/* KPI 3カード */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="rounded-lg border bg-gray-50 p-3 text-center">
            <div className="text-xs text-gray-500 mb-1">月間リード目標</div>
            <div className="text-2xl font-bold tabular-nums text-gray-900">
              {data.target > 0 ? data.target : "–"}
            </div>
            <div className="text-xs text-gray-400">件</div>
          </div>
          <div className="rounded-lg border bg-gray-50 p-3 text-center">
            <div className="text-xs text-gray-500 mb-1">実績（累計）</div>
            <div className="text-2xl font-bold tabular-nums text-gray-900">
              {data.actual}
            </div>
            <div className="text-xs text-gray-400">件</div>
          </div>
          <div
            className={cn(
              "rounded-lg border p-3 text-center",
              achievementColor
            )}
          >
            <div className="text-xs mb-1">達成率</div>
            <div className="text-2xl font-bold tabular-nums">
              {data.target > 0 ? `${data.achievementRate}%` : "–"}
            </div>
          </div>
        </div>

        {/* 流入経路 & 代理店内訳 */}
        {(data.sourceBreakdown.length > 0 ||
          data.agentBreakdown.length > 0) && (
          <div className="space-y-4">
            {/* 流入経路別 */}
            {data.sourceBreakdown.length > 0 && (
              <div>
                <h3 className="text-xs font-medium text-gray-500 mb-2">
                  流入経路別
                </h3>
                <div className="space-y-2">
                  {data.sourceBreakdown.map((source) => (
                    <div
                      key={source.sourceName}
                      className="flex items-center justify-between text-sm"
                    >
                      <span className="text-gray-700">
                        {source.sourceName}
                      </span>
                      <span className="font-medium tabular-nums text-gray-900">
                        {source.count}件
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 代理店別 */}
            {data.agentBreakdown.length > 0 && (
              <div>
                <h3 className="text-xs font-medium text-gray-500 mb-2">
                  代理店別
                </h3>
                <div className="space-y-2">
                  {data.agentBreakdown.map((agent) => (
                    <div
                      key={agent.agentId}
                      className="flex items-center justify-between text-sm"
                    >
                      <span className="text-gray-700">
                        {agent.agentName}
                        {agent.partnerName && (
                          <span className="text-gray-400 text-xs ml-1">
                            （{agent.partnerName}）
                          </span>
                        )}
                      </span>
                      <span className="font-medium tabular-nums text-gray-900">
                        {agent.count}件
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {data.sourceBreakdown.length === 0 &&
          data.agentBreakdown.length === 0 && (
            <div className="text-center text-sm text-gray-400 py-4">
              この月のリード獲得データはありません
            </div>
          )}
      </div>
    </div>
  );
}

export function DashboardClient({
  data,
  months,
  currentMonth,
  funnelData,
  leadData,
  revenueTrendData,
  deptKpiData,
}: DashboardClientProps) {
  const { revenue, grossProfit, customerCount, newContracts } = data;

  const revenueStatus = revenue.target > 0
    ? getRevenueStatus(revenue.achievementRate)
    : { status: "caution" as const, label: "目標未設定" };

  const grossProfitStatus = getGrossProfitStatus(grossProfit.actual);

  const customerStatus = getCustomerStatus(
    customerCount.actual,
    customerCount.prevMonth
  );

  const contractStatus = newContracts.target > 0
    ? getContractStatus(newContracts.achievementRate)
    : { status: "caution" as const, label: "目標未設定" };

  // 累計顧客数の前月比
  const customerChangeRate =
    customerCount.prevMonth > 0
      ? Math.round(
          ((customerCount.actual - customerCount.prevMonth) /
            customerCount.prevMonth) *
            1000
        ) / 10
      : 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl sm:text-2xl font-bold">
          採用ブースト ダッシュボード
        </h1>
        <MonthSelector months={months} currentMonth={currentMonth} />
      </div>

      <div className="grid grid-cols-1 min-[520px]:grid-cols-2 min-[1060px]:grid-cols-4 gap-4">
        {/* カード1: 月次売上 */}
        <KgiCard
          title="月次売上"
          value={formatCurrencyMan(revenue.actual)}
          unit=""
          target={revenue.target > 0 ? formatCurrencyMan(revenue.target) : undefined}
          forecastLabel="着地予測"
          forecastValue={formatCurrencyMan(revenue.forecast)}
          progressPercent={revenue.achievementRate}
          metaLeft={
            revenue.target > 0 ? `${revenue.achievementRate}%` : "-"
          }
          metaRight={`前月 ${formatCurrencyMan(revenue.prevMonth)}`}
          status={revenueStatus.status}
          statusLabel={revenueStatus.label}
        />

        {/* カード2: 月次粗利 */}
        <KgiCard
          title="月次粗利"
          value={formatCurrencyMan(grossProfit.actual)}
          unit=""
          target={
            grossProfit.target > 0
              ? formatCurrencyMan(grossProfit.target)
              : `固定費 ${formatCurrencyMan(grossProfit.fixedCost)}`
          }
          progressPercent={
            grossProfit.target > 0 && grossProfit.actual > 0
              ? Math.round((grossProfit.actual / grossProfit.target) * 100)
              : grossProfit.actual >= 0
                ? 100
                : 0
          }
          metaLeft={grossProfitStatus.label}
          metaRight={`前月 ${formatCurrencyMan(grossProfit.prevMonth)}`}
          status={grossProfitStatus.status}
          statusLabel={grossProfitStatus.label}
          isNegative={grossProfit.actual < 0}
        />

        {/* カード3: 累計顧客数 */}
        <KgiCard
          title="累計顧客数"
          value={String(customerCount.actual)}
          unit="社"
          target={`前月 ${customerCount.prevMonth}社`}
          targetLabel=""
          forecastLabel="見込み（計画含む）"
          forecastValue={`${customerCount.forecast}社`}
          progressPercent={100}
          metaLeft={
            customerCount.prevMonth > 0
              ? `${customerChangeRate > 0 ? "+" : ""}${customerChangeRate}%`
              : "-"
          }
          metaRight="前月比"
          status={customerStatus.status}
          statusLabel={customerStatus.label}
        />

        {/* カード4: 新規契約 */}
        <KgiCard
          title="新規契約"
          value={String(newContracts.actual)}
          unit="社"
          target={
            newContracts.target > 0
              ? `${newContracts.target}社`
              : undefined
          }
          progressPercent={newContracts.achievementRate}
          metaLeft={
            newContracts.target > 0
              ? `${newContracts.achievementRate}%`
              : "-"
          }
          metaRight={`前月 ${newContracts.prevMonth}社`}
          status={contractStatus.status}
          statusLabel={contractStatus.label}
        />
      </div>

      {/* 部門別KPI */}
      <DeptKpiSection data={deptKpiData} currentMonth={currentMonth} />

      {/* セールスファネル & リード獲得 予実管理 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SalesFunnel data={funnelData} />
        <LeadAcquisition data={leadData} />
      </div>

      {/* 月次売上推移チャート */}
      <RevenueTrendChart data={revenueTrendData} />
    </div>
  );
}
