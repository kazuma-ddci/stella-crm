"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Copy, Save, Loader2 } from "lucide-react";
import {
  MONTHLY_KPI_KEYS,
  DEPT_KPI_KEYS,
  DEPT_KPI_GROUPS,
  KPI_LABELS,
  DEPT_KPI_UNITS,
  DEFAULT_FIXED_COST,
} from "@/lib/kpi/constants";
import type { MonthlyKpiKey, DeptKpiKey } from "@/lib/kpi/constants";
import {
  saveKpiTargets,
  saveDeptKpiTargets,
  saveFiscalYearStart,
  copyFromPreviousMonth,
  type KpiTargets,
  type DeptKpiTargets,
} from "./actions";

type KpiTargetsClientProps = {
  months: string[];
  initialMonth: string;
  initialTargets: KpiTargets;
  initialDeptTargets: DeptKpiTargets;
  initialFiscalYearStart: number;
};

/** "2026-03" → "2026年3月" */
function formatMonth(ym: string) {
  const [y, m] = ym.split("-");
  return `${y}年${parseInt(m, 10)}月`;
}

function formatNumber(value: number | null): string {
  if (value === null) return "";
  return new Intl.NumberFormat("ja-JP").format(value);
}

function parseNumber(str: string): number | null {
  const cleaned = str.replace(/,/g, "").trim();
  if (cleaned === "") return null;
  const num = parseInt(cleaned, 10);
  return isNaN(num) ? null : num;
}

const KPI_ORDER: MonthlyKpiKey[] = [
  MONTHLY_KPI_KEYS.MONTHLY_REVENUE,
  MONTHLY_KPI_KEYS.MONTHLY_GROSS_PROFIT,
  MONTHLY_KPI_KEYS.NEW_CONTRACTS,
  MONTHLY_KPI_KEYS.MONTHLY_LEADS,
  MONTHLY_KPI_KEYS.FIXED_COST,
];

const KPI_UNITS: Record<MonthlyKpiKey, string> = {
  [MONTHLY_KPI_KEYS.MONTHLY_REVENUE]: "円",
  [MONTHLY_KPI_KEYS.MONTHLY_GROSS_PROFIT]: "円",
  [MONTHLY_KPI_KEYS.NEW_CONTRACTS]: "社",
  [MONTHLY_KPI_KEYS.MONTHLY_LEADS]: "件",
  [MONTHLY_KPI_KEYS.FIXED_COST]: "円",
};

const KPI_PLACEHOLDERS: Record<MonthlyKpiKey, string> = {
  [MONTHLY_KPI_KEYS.MONTHLY_REVENUE]: "例: 8480000",
  [MONTHLY_KPI_KEYS.MONTHLY_GROSS_PROFIT]: "例: 7400000",
  [MONTHLY_KPI_KEYS.NEW_CONTRACTS]: "例: 5",
  [MONTHLY_KPI_KEYS.MONTHLY_LEADS]: "例: 10",
  [MONTHLY_KPI_KEYS.FIXED_COST]: `デフォルト: ${formatNumber(DEFAULT_FIXED_COST)}`,
};

const ALL_DEPT_KPI_KEYS = Object.values(DEPT_KPI_KEYS);

const DEPT_GROUPS = [
  {
    ...DEPT_KPI_GROUPS.alliance,
    keys: DEPT_KPI_GROUPS.alliance.kpiKeys,
  },
  {
    ...DEPT_KPI_GROUPS.sales,
    keys: DEPT_KPI_GROUPS.sales.kpiKeys,
  },
  {
    ...DEPT_KPI_GROUPS.backoffice,
    keys: DEPT_KPI_GROUPS.backoffice.kpiKeys,
  },
];

export function KpiTargetsClient({
  months,
  initialMonth,
  initialTargets,
  initialDeptTargets,
  initialFiscalYearStart,
}: KpiTargetsClientProps) {
  const [selectedMonth, setSelectedMonth] = useState(initialMonth);
  const [targets, setTargets] = useState<KpiTargets>(initialTargets);
  const [deptTargets, setDeptTargets] = useState<DeptKpiTargets>(initialDeptTargets);
  const [fiscalYearStart, setFiscalYearStart] = useState(initialFiscalYearStart);
  const [fiscalMessage, setFiscalMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [inputValues, setInputValues] = useState<Record<MonthlyKpiKey, string>>(() => {
    const values: Record<string, string> = {};
    for (const key of KPI_ORDER) {
      values[key] = targets[key] !== null ? String(targets[key]) : "";
    }
    return values as Record<MonthlyKpiKey, string>;
  });
  const [deptInputValues, setDeptInputValues] = useState<Record<DeptKpiKey, string>>(() => {
    const values: Record<string, string> = {};
    for (const key of ALL_DEPT_KPI_KEYS) {
      values[key] = deptTargets[key] !== null ? String(deptTargets[key]) : "";
    }
    return values as Record<DeptKpiKey, string>;
  });
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [deptMessage, setDeptMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const handleMonthChange = async (month: string) => {
    setSelectedMonth(month);
    setMessage(null);
    setDeptMessage(null);
    // 新しい月の目標をサーバーから取得
    startTransition(async () => {
      const res = await fetch(
        `/api/kpi-targets?month=${encodeURIComponent(month)}`
      );
      if (res.ok) {
        const data = (await res.json()) as KpiTargets & DeptKpiTargets;
        // KGI
        setTargets(data);
        const values: Record<string, string> = {};
        for (const key of KPI_ORDER) {
          values[key] = data[key] !== null ? String(data[key]) : "";
        }
        setInputValues(values as Record<MonthlyKpiKey, string>);
        // Dept
        setDeptTargets(data);
        const deptValues: Record<string, string> = {};
        for (const key of ALL_DEPT_KPI_KEYS) {
          deptValues[key] = data[key] !== null ? String(data[key]) : "";
        }
        setDeptInputValues(deptValues as Record<DeptKpiKey, string>);
      }
    });
  };

  const handleInputChange = (key: MonthlyKpiKey, value: string) => {
    // 数字とカンマのみ許可
    const cleaned = value.replace(/[^0-9,]/g, "");
    setInputValues((prev) => ({ ...prev, [key]: cleaned }));
  };

  const handleSave = () => {
    setMessage(null);
    const parsed: KpiTargets = {} as KpiTargets;
    for (const key of KPI_ORDER) {
      parsed[key] = parseNumber(inputValues[key]);
    }

    startTransition(async () => {
      try {
        await saveKpiTargets(selectedMonth, parsed);
        setTargets(parsed);
        setMessage({ type: "success", text: "保存しました" });
      } catch {
        setMessage({ type: "error", text: "保存に失敗しました" });
      }
    });
  };

  const handleCopyFromPrevious = () => {
    setMessage(null);
    startTransition(async () => {
      try {
        const prevTargets = await copyFromPreviousMonth(selectedMonth);
        setTargets(prevTargets);
        const values: Record<string, string> = {};
        for (const key of KPI_ORDER) {
          values[key] =
            prevTargets[key] !== null ? String(prevTargets[key]) : "";
        }
        setInputValues(values as Record<MonthlyKpiKey, string>);
        setMessage({ type: "success", text: "前月の目標をコピーしました" });
      } catch {
        setMessage({ type: "error", text: "コピーに失敗しました" });
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl sm:text-2xl font-bold">KPI目標管理</h1>
        <Select value={selectedMonth} onValueChange={handleMonthChange}>
          <SelectTrigger className="w-[160px]">
            <SelectValue>{formatMonth(selectedMonth)}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {months.map((m) => (
              <SelectItem key={m} value={m}>
                {formatMonth(m)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">決算期首月</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <Select
              value={String(fiscalYearStart)}
              onValueChange={(v) => {
                const month = parseInt(v, 10);
                setFiscalYearStart(month);
                setFiscalMessage(null);
                startTransition(async () => {
                  try {
                    await saveFiscalYearStart(month);
                    setFiscalMessage({ type: "success", text: "決算期首月を保存しました" });
                  } catch {
                    setFiscalMessage({ type: "error", text: "保存に失敗しました" });
                  }
                });
              }}
              disabled={isPending}
            >
              <SelectTrigger className="w-[120px]">
                <SelectValue>{fiscalYearStart}月</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                  <SelectItem key={m} value={String(m)}>
                    {m}月
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="text-sm text-gray-500">
              ダッシュボードの売上推移グラフの年度基準に使用されます
            </span>
          </div>
          {fiscalMessage && (
            <div
              className={`mt-3 rounded-md px-3 py-2 text-sm ${
                fiscalMessage.type === "success"
                  ? "bg-green-50 text-green-700"
                  : "bg-red-50 text-red-700"
              }`}
            >
              {fiscalMessage.text}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">
              {formatMonth(selectedMonth)}の目標値
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyFromPrevious}
              disabled={isPending}
            >
              <Copy className="mr-2 h-4 w-4" />
              前月からコピー
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {KPI_ORDER.map((key) => (
              <div key={key} className="grid grid-cols-[180px_1fr_40px] items-center gap-3">
                <Label className="text-sm font-medium text-gray-700">
                  {KPI_LABELS[key]}
                </Label>
                <Input
                  type="text"
                  value={inputValues[key]}
                  onChange={(e) => handleInputChange(key, e.target.value)}
                  placeholder={KPI_PLACEHOLDERS[key]}
                  disabled={isPending}
                />
                <span className="text-sm text-gray-500">
                  {KPI_UNITS[key]}
                </span>
              </div>
            ))}
          </div>

          {message && (
            <div
              className={`mt-4 rounded-md px-3 py-2 text-sm ${
                message.type === "success"
                  ? "bg-green-50 text-green-700"
                  : "bg-red-50 text-red-700"
              }`}
            >
              {message.text}
            </div>
          )}

          <div className="mt-6 flex justify-end">
            <Button onClick={handleSave} disabled={isPending}>
              {isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              保存
            </Button>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {formatMonth(selectedMonth)}の部門別KPI目標
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {DEPT_GROUPS.map((group) => (
              <div key={group.tabKey}>
                <h3 className="text-sm font-semibold text-gray-700 mb-3 pb-1 border-b">
                  {group.departmentName}（{group.managerName}）
                </h3>
                <div className="space-y-3">
                  {group.keys.map((key) => (
                    <div key={key} className="grid grid-cols-[180px_1fr_40px] items-center gap-3">
                      <Label className="text-sm font-medium text-gray-700">
                        {KPI_LABELS[key]}
                      </Label>
                      <Input
                        type="text"
                        value={deptInputValues[key]}
                        onChange={(e) => {
                          const cleaned = e.target.value.replace(/[^0-9,.]/g, "");
                          setDeptInputValues((prev) => ({ ...prev, [key]: cleaned }));
                        }}
                        placeholder={`例: ${DEPT_KPI_UNITS[key] === "%" ? "50" : DEPT_KPI_UNITS[key] === "日" ? "30" : "10"}`}
                        disabled={isPending}
                      />
                      <span className="text-sm text-gray-500">
                        {DEPT_KPI_UNITS[key]}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {deptMessage && (
            <div
              className={`mt-4 rounded-md px-3 py-2 text-sm ${
                deptMessage.type === "success"
                  ? "bg-green-50 text-green-700"
                  : "bg-red-50 text-red-700"
              }`}
            >
              {deptMessage.text}
            </div>
          )}

          <div className="mt-6 flex justify-end">
            <Button
              onClick={() => {
                setDeptMessage(null);
                const parsed: DeptKpiTargets = {} as DeptKpiTargets;
                for (const key of ALL_DEPT_KPI_KEYS) {
                  const cleaned = deptInputValues[key].replace(/,/g, "").trim();
                  if (cleaned === "") {
                    parsed[key] = null;
                  } else {
                    const num = parseFloat(cleaned);
                    parsed[key] = isNaN(num) ? null : num;
                  }
                }
                startTransition(async () => {
                  try {
                    await saveDeptKpiTargets(selectedMonth, parsed);
                    setDeptTargets(parsed);
                    setDeptMessage({ type: "success", text: "部門KPI目標を保存しました" });
                  } catch {
                    setDeptMessage({ type: "error", text: "保存に失敗しました" });
                  }
                });
              }}
              disabled={isPending}
            >
              {isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              部門KPI目標を保存
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
