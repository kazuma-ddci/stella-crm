"use client";

import { MonthSelector } from "./month-selector";
import type {
  KgiData,
  FunnelData,
  LeadAcquisitionData,
  RevenueTrendWithProfitData,
  AgentRoiData,
  LeadSourceForecastData,
} from "./actions";
import type { DeptTabData } from "./dept-kpi-actions";
import { DeptKpiSection } from "./dept-kpi-section";
import { cn } from "@/lib/utils";
import {
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

type DashboardClientProps = {
  kgiData: KgiData;
  months: string[];
  currentMonth: string;
  funnelData: FunnelData;
  leadData: LeadAcquisitionData;
  revenueTrendData: RevenueTrendWithProfitData;
  deptKpiData: DeptTabData[];
  agentRoiData: AgentRoiData;
  leadSourceForecastData: LeadSourceForecastData;
};

// ファネルバーの色
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
                          {stage.companyCount > 0 ? stage.companyCount : "–"}
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
  const man = Math.round((value / 10000) * 10) / 10;
  return man % 1 === 0 ? `${man}万` : `${man.toFixed(1)}万`;
}

/** 億・万単位で金額フォーマット */
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

function formatCurrencyShort(value: number): string {
  const abs = Math.abs(value);
  const prefix = value < 0 ? "▲¥" : "¥";
  if (abs >= 10_000) {
    const man = Math.round((abs / 10_000) * 10) / 10;
    return `${prefix}${man % 1 === 0 ? String(man) : man.toFixed(1)}万`;
  }
  return `${prefix}${new Intl.NumberFormat("ja-JP").format(abs)}`;
}

// ============================================
// 売上推移グラフ（粗利エリア付き）
// ============================================

function RevenueTrendChart({
  data,
}: {
  data: RevenueTrendWithProfitData;
}) {
  const chartData = data.months.map((m) => ({
    label: m.label,
    target: m.target,
    actual: m.actual,
    forecast: m.forecast,
    grossProfit: m.grossProfit,
  }));

  const annualTarget = data.months.reduce(
    (sum, m) => sum + (m.target ?? 0),
    0
  );
  const annualActual = data.months.reduce(
    (sum, m) => sum + (m.actual ?? 0),
    0
  );

  return (
    <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
      <div className="p-5 sm:p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-5">
          月次売上推移（計画 vs 実績 vs 粗利）
        </h2>

        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
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
                  const labelMap: Record<string, string> = {
                    target: "計画",
                    actual: "実績",
                    forecast: "着地予測",
                    grossProfit: "粗利",
                  };
                  return [
                    `¥${formatMan(Number(value))}`,
                    labelMap[String(name)] ?? String(name),
                  ];
                }}
                contentStyle={{
                  borderRadius: "8px",
                  border: "1px solid #e5e7eb",
                  fontSize: "13px",
                }}
              />
              <Legend
                formatter={(value: string) => {
                  const map: Record<string, string> = {
                    target: "計画",
                    actual: "実績",
                    forecast: "着地予測",
                    grossProfit: "粗利",
                  };
                  return map[value] ?? value;
                }}
                iconType="line"
                wrapperStyle={{ fontSize: "13px" }}
              />
              {/* 粗利エリア */}
              <Area
                type="monotone"
                dataKey="grossProfit"
                fill="#22c55e"
                fillOpacity={0.1}
                stroke="#22c55e"
                strokeWidth={1.5}
                strokeDasharray="4 2"
                connectNulls
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
            </ComposedChart>
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

// ============================================
// リード獲得 + 代理店ROI + リードソース予実
// ============================================

function LeadAndRoiSection({
  leadData,
  agentRoiData,
  leadSourceForecastData,
}: {
  leadData: LeadAcquisitionData;
  agentRoiData: AgentRoiData;
  leadSourceForecastData: LeadSourceForecastData;
}) {
  const achievementStatus =
    leadData.target > 0
      ? leadData.achievementRate >= 100
        ? "achieved"
        : leadData.achievementRate >= 80
          ? "good"
          : leadData.achievementRate >= 50
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
        <h2 className="text-base font-semibold text-gray-900 mb-5">
          リード獲得 予実管理 & 代理店ROI
        </h2>

        {/* リード目標/実績/達成率 */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="rounded-lg border bg-gray-50 p-3 text-center">
            <div className="text-xs text-gray-500 mb-1">月間リード目標</div>
            <div className="text-2xl font-bold tabular-nums text-gray-900">
              {leadData.target > 0 ? leadData.target : "–"}
            </div>
            <div className="text-xs text-gray-400">件</div>
          </div>
          <div className="rounded-lg border bg-gray-50 p-3 text-center">
            <div className="text-xs text-gray-500 mb-1">実績（累計）</div>
            <div className="text-2xl font-bold tabular-nums text-gray-900">
              {leadData.actual}
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
              {leadData.target > 0 ? `${leadData.achievementRate}%` : "–"}
            </div>
          </div>
        </div>

        <div className="space-y-5">
          {/* リードソース別予実 */}
          {leadSourceForecastData.sources.length > 0 && (
            <div>
              <h3 className="text-xs font-medium text-gray-500 mb-2">
                流入経路別 予実（契約数）
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-xs text-gray-500">
                      <th className="text-left py-1.5 font-medium">流入経路</th>
                      <th className="text-right py-1.5 font-medium w-16">目標</th>
                      <th className="text-right py-1.5 font-medium w-16">実績</th>
                      <th className="text-right py-1.5 font-medium w-20">達成率</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leadSourceForecastData.sources.map((s) => (
                      <tr key={s.sourceId} className="border-b last:border-b-0">
                        <td className="py-1.5 text-gray-700">{s.sourceName}</td>
                        <td className="py-1.5 text-right tabular-nums text-gray-500">
                          {s.target > 0 ? `${s.target}社` : "–"}
                        </td>
                        <td className="py-1.5 text-right tabular-nums font-medium text-gray-900">
                          {s.actual}社
                        </td>
                        <td className="py-1.5 text-right">
                          {s.target > 0 ? (
                            <span
                              className={cn(
                                "tabular-nums font-medium text-xs",
                                s.achievementRate >= 100
                                  ? "text-green-600"
                                  : s.achievementRate >= 50
                                    ? "text-yellow-600"
                                    : "text-red-600"
                              )}
                            >
                              {s.achievementRate}%
                            </span>
                          ) : (
                            <span className="text-gray-400 text-xs">–</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 代理店ROI */}
          {agentRoiData.agents.length > 0 && (
            <div>
              <h3 className="text-xs font-medium text-gray-500 mb-2">
                代理店ROI
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-xs text-gray-500">
                      <th className="text-left py-1.5 font-medium">代理店</th>
                      <th className="text-right py-1.5 font-medium w-24">獲得コスト</th>
                      <th className="text-right py-1.5 font-medium w-24">契約売上</th>
                      <th className="text-right py-1.5 font-medium w-16">ROI</th>
                    </tr>
                  </thead>
                  <tbody>
                    {agentRoiData.agents.map((a) => (
                      <tr key={a.agentId} className="border-b last:border-b-0">
                        <td className="py-1.5 text-gray-700">{a.agentName}</td>
                        <td className="py-1.5 text-right tabular-nums text-gray-500">
                          {formatCurrencyShort(a.cost)}
                        </td>
                        <td className="py-1.5 text-right tabular-nums font-medium text-gray-900">
                          {formatCurrencyShort(a.revenue)}
                        </td>
                        <td className="py-1.5 text-right">
                          {a.roi !== null ? (
                            <span
                              className={cn(
                                "tabular-nums font-medium text-xs",
                                a.roi >= 1
                                  ? "text-green-600"
                                  : "text-red-600"
                              )}
                            >
                              {a.roi}x
                            </span>
                          ) : (
                            <span className="text-gray-400 text-xs">–</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 流入経路別リード内訳（既存） */}
          {leadData.sourceBreakdown.length > 0 && (
            <div>
              <h3 className="text-xs font-medium text-gray-500 mb-2">
                流入経路別リード数
              </h3>
              <div className="space-y-2">
                {leadData.sourceBreakdown.map((source) => (
                  <div
                    key={source.sourceName}
                    className="flex items-center justify-between text-sm"
                  >
                    <span className="text-gray-700">{source.sourceName}</span>
                    <span className="font-medium tabular-nums text-gray-900">
                      {source.count}件
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {leadData.sourceBreakdown.length === 0 &&
          agentRoiData.agents.length === 0 &&
          leadSourceForecastData.sources.length === 0 && (
            <div className="text-center text-sm text-gray-400 py-4">
              この月のデータはありません
            </div>
          )}
      </div>
    </div>
  );
}

export function DashboardClient({
  kgiData,
  months,
  currentMonth,
  funnelData,
  leadData,
  revenueTrendData,
  deptKpiData,
  agentRoiData,
  leadSourceForecastData,
}: DashboardClientProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl sm:text-2xl font-bold">KPIダッシュボード</h1>
        <MonthSelector months={months} currentMonth={currentMonth} />
      </div>

      {/* KGI + 部門別KPI（タブ切替） */}
      <DeptKpiSection
        data={deptKpiData}
        currentMonth={currentMonth}
        kgiData={kgiData}
      />

      {/* セールスファネル & リード獲得/ROI/予実 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SalesFunnel data={funnelData} />
        <LeadAndRoiSection
          leadData={leadData}
          agentRoiData={agentRoiData}
          leadSourceForecastData={leadSourceForecastData}
        />
      </div>

      {/* 月次売上推移チャート（粗利エリア付き） */}
      <RevenueTrendChart data={revenueTrendData} />
    </div>
  );
}
