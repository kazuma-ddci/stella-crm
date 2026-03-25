"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { KgiCard } from "./kgi-card";
import type { KgiData } from "./actions";
import type {
  DeptTabData,
  DeptKpiItem,
  ObservationItem,
} from "./dept-kpi-actions";

type DeptKpiSectionProps = {
  data: DeptTabData[];
  currentMonth: string;
  kgiData: KgiData;
};

function formatMonth(ym: string) {
  const [y, m] = ym.split("-");
  return `${y}年${parseInt(m, 10)}月`;
}

function formatCurrencyMan(value: number): string {
  const absValue = Math.abs(value);
  if (absValue >= 10000) {
    const man = Math.round((absValue / 10000) * 10) / 10;
    const prefix = value < 0 ? "▲" : "¥";
    const formatted = man % 1 === 0 ? String(man) : man.toFixed(1);
    return `${prefix}${formatted}万`;
  }
  const prefix = value < 0 ? "▲¥" : "¥";
  return `${prefix}${new Intl.NumberFormat("ja-JP").format(absValue)}`;
}

function getAchievementStatus(rate: number) {
  if (rate >= 100) return { status: "achieved" as const, label: "達成" };
  if (rate >= 80) return { status: "good" as const, label: "好調" };
  if (rate >= 50) return { status: "caution" as const, label: "注意" };
  return { status: "behind" as const, label: "未達" };
}

function getGrossProfitStatus(value: number) {
  if (value >= 0) return { status: "surplus" as const, label: "黒字" };
  return { status: "deficit" as const, label: "赤字" };
}

export function DeptKpiSection({
  data,
  currentMonth,
  kgiData,
}: DeptKpiSectionProps) {
  const [activeTab, setActiveTab] = useState("kgi");

  const tabData = data.find((d) => d.tabKey === activeTab);

  return (
    <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
      {/* タブバー */}
      <div className="border-b bg-gray-50/50">
        <div className="flex overflow-x-auto">
          {/* KGIタブ */}
          <button
            onClick={() => setActiveTab("kgi")}
            className={cn(
              "px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors",
              activeTab === "kgi"
                ? "border-blue-500 text-blue-600 bg-white"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            )}
          >
            KGI
          </button>
          {/* 部門タブ */}
          {data.map((tab) => (
            <button
              key={tab.tabKey}
              onClick={() => setActiveTab(tab.tabKey)}
              className={cn(
                "px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors",
                activeTab === tab.tabKey
                  ? "border-blue-500 text-blue-600 bg-white"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              )}
            >
              {tab.departmentName}
            </button>
          ))}
        </div>
      </div>

      {/* タブコンテンツ */}
      <div className="p-5 sm:p-6">
        {activeTab === "kgi" ? (
          <KgiPanel kgiData={kgiData} currentMonth={currentMonth} />
        ) : tabData?.isPreparing ? (
          <div className="text-center py-8">
            <div className="text-2xl mb-2 opacity-50">🔬</div>
            <div className="text-gray-400 text-sm">データ収集中</div>
            <div className="text-gray-300 text-xs mt-1">
              現在PoC中のため、データが揃い次第表示されます
            </div>
          </div>
        ) : tabData ? (
          <>
            {/* ヘッダー */}
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-900">
                {tabData.departmentName}
              </h3>
              <span className="text-xs text-gray-400">
                {formatMonth(currentMonth)} 実績 / 目標
              </span>
            </div>

            {/* KPIセクション */}
            {tabData.kpis.length > 0 && (
              <>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-[10px] font-semibold tracking-wider text-gray-400 uppercase">
                    KPI
                  </span>
                  <span className="text-[10px] font-medium text-blue-500 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100">
                    {tabData.kpis.length}指標
                  </span>
                  <div className="flex-1 h-px bg-gray-100" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
                  {tabData.kpis.map((kpi) => (
                    <KpiCard key={kpi.key} kpi={kpi} />
                  ))}
                </div>
              </>
            )}

            {/* 観測指標セクション */}
            {tabData.observations.length > 0 && (
              <>
                <div className="flex items-center gap-2 mb-3 mt-2">
                  <span className="text-[10px] font-semibold tracking-wider text-gray-400 uppercase">
                    観測指標
                  </span>
                  <span className="text-[10px] font-medium text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded border border-gray-200">
                    {tabData.observations.length}指標
                  </span>
                  <div className="flex-1 h-px bg-gray-100" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {tabData.observations.map((obs) => (
                    <ObservationCard key={obs.key} obs={obs} />
                  ))}
                </div>
              </>
            )}

            {tabData.kpis.length === 0 &&
              tabData.observations.length === 0 && (
                <div className="text-center py-6 text-gray-400 text-sm">
                  この部門のKPIはまだ設定されていません
                </div>
              )}
          </>
        ) : null}
      </div>
    </div>
  );
}

// ============================================
// KGIパネル（最初のタブ）
// ============================================

function KgiPanel({
  kgiData,
  currentMonth,
}: {
  kgiData: KgiData;
  currentMonth: string;
}) {
  const { revenue, grossProfit, newContracts } = kgiData;

  const revenueStatus =
    revenue.target > 0
      ? getAchievementStatus(revenue.achievementRate)
      : { status: "caution" as const, label: "目標未設定" };

  const grossProfitStatus = getGrossProfitStatus(grossProfit.actual);

  const grossProfitAchievementRate =
    grossProfit.target > 0 && grossProfit.actual > 0
      ? Math.round((grossProfit.actual / grossProfit.target) * 100)
      : grossProfit.actual >= 0
        ? 100
        : 0;

  const contractStatus =
    newContracts.target > 0
      ? getAchievementStatus(newContracts.achievementRate)
      : { status: "caution" as const, label: "目標未設定" };

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-900">事業KGI</h3>
        <span className="text-xs text-gray-400">
          {formatMonth(currentMonth)} 実績 / 目標
        </span>
      </div>

      <div className="overflow-x-auto -mx-5 sm:-mx-6 px-5 sm:px-6">
      <div className="grid grid-cols-5 gap-4" style={{ minWidth: "900px" }}>
        <KgiCard
          title="月次売上"
          value={formatCurrencyMan(revenue.actual)}
          unit=""
          target={
            revenue.target > 0
              ? formatCurrencyMan(revenue.target)
              : undefined
          }
          progressPercent={revenue.achievementRate}
          metaLeft={
            revenue.target > 0 ? `${revenue.achievementRate}%` : "-"
          }
          metaRight={`前月 ${formatCurrencyMan(revenue.prevMonth)}`}
          status={revenueStatus.status}
          statusLabel={revenueStatus.label}
        />

        <KgiCard
          title="月次粗利"
          value={formatCurrencyMan(grossProfit.actual)}
          unit=""
          target={
            grossProfit.target > 0
              ? formatCurrencyMan(grossProfit.target)
              : `固定費 ${formatCurrencyMan(grossProfit.fixedCost)}`
          }
          progressPercent={grossProfitAchievementRate}
          metaLeft={grossProfitStatus.label}
          metaRight={`前月 ${formatCurrencyMan(grossProfit.prevMonth)}`}
          status={grossProfitStatus.status}
          statusLabel={grossProfitStatus.label}
          isNegative={grossProfit.actual < 0}
        />

        <PendingKgiCard
          title="採用目標達成率"
          targetLabel="目標 80%"
          message="データ収集中"
        />

        <PendingKgiCard
          title="応募目標達成率"
          targetLabel="目標 90%"
          message="データ収集中"
        />

        <KgiCard
          title="新規契約数"
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
      </div>
    </>
  );
}

/** 開発中のKGIカード */
function PendingKgiCard({
  title,
  targetLabel,
  message,
}: {
  title: string;
  targetLabel: string;
  message: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-dashed border-gray-300 bg-gray-50/50 shadow-sm h-full flex flex-col">
      <div className="h-0.5 bg-gray-300" />
      <div className="flex flex-col p-4 sm:p-5 h-full">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-medium text-gray-500">{title}</span>
          <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium bg-gray-100 text-gray-500 border border-gray-200">
            <span className="h-1.5 w-1.5 rounded-full bg-gray-400" />
            開発中
          </span>
        </div>
        <div className="mb-2">
          <span className="text-sm font-medium text-gray-400">{message}</span>
        </div>
        <div className="text-xs text-gray-400 mb-1">{targetLabel}</div>
        <div className="flex-1" />
        <div className="h-1 w-full rounded-full bg-gray-200 mb-2 mt-2" />
        <div className="flex items-center justify-between text-[11px]">
          <span className="font-medium text-gray-400">—</span>
          <span className="text-gray-300">—</span>
        </div>
      </div>
    </div>
  );
}

// ============================================
// 部門KPIカード
// ============================================

function KpiCard({ kpi }: { kpi: DeptKpiItem }) {
  const { value, preparingMessage } = kpi;
  const { actual, target, achievementRate, unit } = value;

  let badgeStyle: string;
  let badgeText: string;
  let barColor: string;
  let barWidth: number;
  let accentColor: string;

  if (preparingMessage) {
    badgeStyle = "bg-gray-100 text-gray-500 border-gray-200";
    badgeText = preparingMessage;
    barColor = "bg-gray-200";
    barWidth = 0;
    accentColor = "bg-gray-300";
  } else if (actual === null) {
    badgeStyle = "bg-gray-100 text-gray-500 border-gray-200";
    badgeText = "未計測";
    barColor = "bg-gray-200";
    barWidth = 0;
    accentColor = "bg-gray-300";
  } else if (target === 0) {
    badgeStyle = "bg-gray-100 text-gray-500 border-gray-200";
    badgeText = "目標未設定";
    barColor = "bg-gray-300";
    barWidth = 0;
    accentColor = "bg-gray-300";
  } else if (achievementRate >= 100) {
    badgeStyle = "bg-green-50 text-green-600 border-green-200";
    badgeText = "達成";
    barColor = "bg-green-500";
    barWidth = 100;
    accentColor = "bg-green-500";
  } else if (achievementRate >= 80) {
    badgeStyle = "bg-green-50 text-green-600 border-green-200";
    badgeText = "好調";
    barColor = "bg-green-500";
    barWidth = achievementRate;
    accentColor = "bg-green-500";
  } else if (achievementRate >= 50) {
    badgeStyle = "bg-yellow-50 text-yellow-600 border-yellow-200";
    badgeText = "注意";
    barColor = "bg-yellow-500";
    barWidth = achievementRate;
    accentColor = "bg-yellow-500";
  } else {
    badgeStyle = "bg-red-50 text-red-600 border-red-200";
    badgeText = "未達";
    barColor = "bg-red-500";
    barWidth = achievementRate;
    accentColor = "bg-red-500";
  }

  return (
    <div className="relative rounded-lg border bg-white overflow-hidden flex flex-col">
      <div className={cn("h-0.5", accentColor)} />
      <div className="p-4 flex flex-col flex-1">
        <div className="flex items-start justify-between mb-3">
          <span className="text-xs font-medium text-gray-500">
            {kpi.label}
          </span>
          <span
            className={cn(
              "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium border shrink-0 ml-2",
              badgeStyle
            )}
          >
            {badgeText}
          </span>
        </div>

        <div className="mb-2">
          <span className="text-2xl font-bold tabular-nums text-gray-900">
            {actual !== null ? actual : "—"}
          </span>
          <span className="ml-1 text-sm text-gray-400">{unit}</span>
        </div>

        <div className="text-xs text-gray-500 mb-3">
          目標{" "}
          <span className="font-medium text-gray-700 tabular-nums">
            {target > 0 ? `${target}${unit}` : "未設定"}
          </span>
        </div>

        <div className="mt-auto">
          <div className="h-1 w-full rounded-full bg-gray-100 mb-1">
            <div
              className={cn("h-1 rounded-full transition-all", barColor)}
              style={{
                width: `${Math.min(Math.max(barWidth, 0), 100)}%`,
              }}
            />
          </div>
          {actual !== null && target > 0 && (
            <div className="text-right">
              <span
                className={cn(
                  "text-[10px] font-medium tabular-nums",
                  achievementRate >= 80
                    ? "text-green-600"
                    : achievementRate >= 50
                      ? "text-yellow-600"
                      : "text-red-600"
                )}
              >
                {achievementRate}%
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ObservationCard({ obs }: { obs: ObservationItem }) {
  return (
    <div className="rounded-lg border border-gray-200/80 bg-gray-50/50 p-4 flex flex-col">
      <div className="flex items-start justify-between mb-3">
        <span className="text-xs font-medium text-gray-500">{obs.label}</span>
        <span className="text-[10px] font-medium text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded border border-gray-200">
          観測
        </span>
      </div>

      <div className="mb-1">
        <span className="text-2xl font-bold tabular-nums text-gray-900">
          {obs.value}
        </span>
        {obs.unit && (
          <span className="ml-1 text-sm text-gray-400">{obs.unit}</span>
        )}
      </div>

      <div className="text-xs text-gray-500 flex items-center gap-1">
        {obs.delta && (
          <span
            className={cn(
              "font-semibold",
              obs.deltaDir === "up"
                ? "text-green-600"
                : obs.deltaDir === "down"
                  ? "text-red-600"
                  : "text-gray-500"
            )}
          >
            {obs.delta}
          </span>
        )}
        {obs.sub && <span>{obs.sub}</span>}
      </div>
    </div>
  );
}
