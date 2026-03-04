"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import type { DeptTabData } from "./dept-kpi-actions";

type DeptKpiSectionProps = {
  data: DeptTabData[];
  currentMonth: string;
};

const TABS = [
  { key: "kgi", label: "KGI" },
  { key: "alliance", label: "Alliance" },
  { key: "sales", label: "Sales" },
  { key: "backoffice", label: "バックオフィス" },
  { key: "ops", label: "Ops" },
  { key: "cs", label: "CS" },
];

function formatMonth(ym: string) {
  const [y, m] = ym.split("-");
  return `${y}年${parseInt(m, 10)}月`;
}

export function DeptKpiSection({ data, currentMonth }: DeptKpiSectionProps) {
  const [activeTab, setActiveTab] = useState("alliance");

  const tabData = data.find((d) => d.tabKey === activeTab);
  const isPreparingTab = ["kgi", "ops", "cs"].includes(activeTab);

  return (
    <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
      {/* タブバー */}
      <div className="border-b bg-gray-50/50">
        <div className="flex overflow-x-auto">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                "px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors",
                activeTab === tab.key
                  ? "border-blue-500 text-blue-600 bg-white"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* タブコンテンツ */}
      <div className="p-5 sm:p-6">
        {isPreparingTab ? (
          <div className="text-center py-8">
            <div className="text-gray-400 text-sm">準備中</div>
            <div className="text-gray-300 text-xs mt-1">
              {activeTab === "kgi"
                ? "KGI指標は上部のカードに表示されています"
                : "このセクションは今後追加予定です"}
            </div>
          </div>
        ) : tabData ? (
          <>
            {/* ヘッダー */}
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-900">
                {tabData.departmentName}
                <span className="text-gray-400 font-normal ml-1">
                  （{tabData.managerName}）
                </span>
              </h3>
              <span className="text-xs text-gray-400">
                {formatMonth(currentMonth)}
              </span>
            </div>

            {/* KPIカードグリッド */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {tabData.kpis.map((kpi) => (
                <KpiCard key={kpi.key} kpi={kpi} />
              ))}
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}

function KpiCard({ kpi }: { kpi: DeptTabData["kpis"][number] }) {
  const { value, preparingMessage } = kpi;
  const { actual, target, achievementRate, unit } = value;

  // ステータス判定
  let badgeStyle: string;
  let badgeText: string;
  let barColor: string;
  let barWidth: number;

  if (preparingMessage) {
    badgeStyle = "bg-gray-100 text-gray-500 border-gray-200";
    badgeText = preparingMessage;
    barColor = "bg-gray-200";
    barWidth = 0;
  } else if (actual === null) {
    badgeStyle = "bg-gray-100 text-gray-500 border-gray-200";
    badgeText = "未計測";
    barColor = "bg-gray-200";
    barWidth = 0;
  } else if (target === 0) {
    badgeStyle = "bg-gray-100 text-gray-500 border-gray-200";
    badgeText = "目標未設定";
    barColor = "bg-gray-300";
    barWidth = 0;
  } else if (achievementRate >= 100) {
    badgeStyle = "bg-green-50 text-green-600 border-green-200";
    badgeText = `${achievementRate}% 達成`;
    barColor = "bg-green-500";
    barWidth = 100;
  } else {
    badgeStyle = "bg-red-50 text-red-600 border-red-200";
    badgeText = "未達 要改善";
    barColor = "bg-red-500";
    barWidth = Math.min(achievementRate, 100);
  }

  return (
    <div className="rounded-lg border bg-white p-4 flex flex-col">
      {/* カード名 + バッジ */}
      <div className="flex items-start justify-between mb-3">
        <span className="text-xs font-medium text-gray-500">{kpi.label}</span>
        <span
          className={cn(
            "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium border shrink-0 ml-2",
            badgeStyle
          )}
        >
          {badgeText}
        </span>
      </div>

      {/* 実績値 */}
      <div className="mb-2">
        <span className="text-2xl font-bold tabular-nums text-gray-900">
          {actual !== null ? actual : "—"}
        </span>
        <span className="ml-1 text-sm text-gray-400">{unit}</span>
      </div>

      {/* 目標行 */}
      <div className="text-xs text-gray-500 mb-3">
        目標{" "}
        <span className="font-medium text-gray-700 tabular-nums">
          {target > 0 ? `${target}${unit}` : "未設定"}
        </span>
      </div>

      {/* プログレスバー */}
      <div className="mt-auto">
        <div className="h-1 w-full rounded-full bg-gray-100">
          <div
            className={cn("h-1 rounded-full transition-all", barColor)}
            style={{ width: `${Math.min(Math.max(barWidth, 0), 100)}%` }}
          />
        </div>
      </div>
    </div>
  );
}
