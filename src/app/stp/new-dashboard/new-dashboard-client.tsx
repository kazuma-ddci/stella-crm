"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  BarChart3,
  Briefcase,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  CircleDollarSign,
  ClipboardList,
  ExternalLink,
  FileWarning,
  Filter,
  Handshake,
  Hourglass,
  Package,
  PieChart as PieChartIcon,
  Save,
  Search,
  Target,
  TrendingUp,
  User,
  Users,
  XCircle,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import type {
  ChannelAnalysisData,
  ChannelAnalysisRow,
  CurrentFunnelResult,
  DashboardMode,
  DashboardOption,
  DealFocusCondition,
  DealManagementData,
  DealManagementRow,
  DealPriority,
  FunnelMetric,
  FunnelRate,
  FunnelTargetMetricKey,
  FunnelTargetValues,
  NewDashboardData,
} from "./types";
import { ALL_STAFF } from "./types";
import { saveDashboardFunnelTargets } from "./target-actions";

type SearchParams = {
  tab?: string;
  period?: string;
  product?: string;
  staff?: string;
  mode?: string;
};

type Props = {
  initialSearchParams: SearchParams;
  data: NewDashboardData;
};

type DashboardTab = {
  value: string;
  label: string;
  title: string;
  description: string;
  icon: React.ElementType;
  showStaffFilter: boolean;
  accent: string;
};

const DASHBOARD_TABS: DashboardTab[] = [
  {
    value: "funnel",
    label: "MA・SFA・契約ファネル",
    title: "MA・SFA・契約ファネル",
    description: "リード発生月を起点に、有効化・商談・契約・失注までを追跡します。",
    icon: Filter,
    showStaffFilter: true,
    accent: "border-blue-200 bg-blue-50 text-blue-700",
  },
  {
    value: "channel",
    label: "チャネル分析",
    title: "チャネル分析",
    description: "流入経路ごとの獲得効率と成果を確認する画面です。",
    icon: BarChart3,
    showStaffFilter: false,
    accent: "border-cyan-200 bg-cyan-50 text-cyan-700",
  },
  {
    value: "deals",
    label: "案件管理",
    title: "案件管理",
    description: "進行中の案件、優先フォロー、次アクションを確認する画面です。",
    icon: Briefcase,
    showStaffFilter: true,
    accent: "border-amber-200 bg-amber-50 text-amber-700",
  },
  {
    value: "exit-kpi",
    label: "売却KPIダッシュボード",
    title: "売却KPIダッシュボード",
    description: "売却判断に関わる事業指標を確認する画面です。",
    icon: TrendingUp,
    showStaffFilter: false,
    accent: "border-emerald-200 bg-emerald-50 text-emerald-700",
  },
  {
    value: "management",
    label: "経営ダッシュボード",
    title: "経営ダッシュボード",
    description: "経営サマリー、目標進捗、財務指標を確認する画面です。",
    icon: CircleDollarSign,
    showStaffFilter: false,
    accent: "border-violet-200 bg-violet-50 text-violet-700",
  },
];

const FUNNEL_MODES: { value: DashboardMode; label: string }[] = [
  { value: "current", label: "当月発生" },
  { value: "cohort", label: "リード発生月別成果" },
  { value: "snapshot", label: "月末残高" },
];

const TARGET_FIELDS: { key: FunnelTargetMetricKey; label: string }[] = [
  { key: "lead", label: "リード" },
  { key: "validLead", label: "有効リード" },
  { key: "meeting", label: "商談実施" },
  { key: "pending", label: "検討中" },
  { key: "contract", label: "契約" },
  { key: "lost", label: "失注" },
];

const METRIC_ICONS: Record<string, React.ElementType> = {
  lead: Users,
  validLead: CheckCircle2,
  meeting: Handshake,
  pending: Hourglass,
  contract: ClipboardList,
  lost: XCircle,
};

const TONE_CLASSES: Record<FunnelMetric["tone"], string> = {
  blue: "border-blue-200 bg-blue-50 text-blue-700",
  green: "border-green-200 bg-green-50 text-green-700",
  orange: "border-orange-200 bg-orange-50 text-orange-700",
  red: "border-red-200 bg-red-50 text-red-700",
  purple: "border-purple-200 bg-purple-50 text-purple-700",
  gray: "border-gray-200 bg-gray-50 text-gray-700",
};

const PIE_COLORS = ["#2563eb", "#f59e0b", "#ef4444", "#22c55e", "#8b5cf6", "#64748b"];

function isValidMode(value: string | null): value is DashboardMode {
  return value === "current" || value === "cohort" || value === "snapshot";
}

function formatRate(value: number | null) {
  return value == null ? "-" : `${value.toFixed(1)}%`;
}

function formatCount(value: number, unit: "件" | "%") {
  if (unit === "%") return `${value.toFixed(1)}%`;
  return `${new Intl.NumberFormat("ja-JP").format(value)}件`;
}

function formatCurrency(value: number | null) {
  if (value == null) return "-";
  return `¥${new Intl.NumberFormat("ja-JP").format(value)}`;
}

function formatChannelMetric(value: number | null, format: "count" | "rate" | "currency") {
  if (format === "currency") return formatCurrency(value);
  if (format === "rate") return formatRate(value);
  return value == null ? "-" : `${new Intl.NumberFormat("ja-JP").format(value)}件`;
}

function formatSignedCount(value: number, unit: "件" | "%") {
  const prefix = value > 0 ? "+" : "";
  if (unit === "%") return `${prefix}${value.toFixed(1)}%`;
  return `${prefix}${new Intl.NumberFormat("ja-JP").format(value)}件`;
}

function formatPointDiff(value: number | null) {
  if (value == null) return "-";
  return `${value > 0 ? "+" : ""}${value.toFixed(1)}pt`;
}

function formatCapturedAt(value: string | null) {
  if (!value) return "";
  return new Date(value).toLocaleString("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDate(value: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

export function NewDashboardClient({ initialSearchParams, data }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const tabParam = searchParams.get("tab") ?? initialSearchParams.tab ?? "";
  const periodParam = searchParams.get("period") ?? initialSearchParams.period ?? "";
  const productParam = searchParams.get("product") ?? initialSearchParams.product ?? "";
  const staffParam = searchParams.get("staff") ?? initialSearchParams.staff ?? "";
  const modeParam = searchParams.get("mode") ?? initialSearchParams.mode ?? "";

  const activeTab = DASHBOARD_TABS.some((tab) => tab.value === tabParam)
    ? tabParam
    : "funnel";
  const activeTabConfig = DASHBOARD_TABS.find((tab) => tab.value === activeTab) ?? DASHBOARD_TABS[0];
  const activeMode: DashboardMode = isValidMode(modeParam) ? modeParam : "current";

  const selectedPeriod = data.periodOptions.some((option) => option.value === periodParam)
    ? periodParam
    : data.selectedPeriod;
  const selectedProduct = data.productOptions.some((option) => option.value === productParam)
    ? productParam
    : data.selectedProduct;
  const selectedStaff =
    staffParam === ALL_STAFF || data.staffOptions.some((option) => option.value === staffParam)
      ? staffParam || ALL_STAFF
      : data.selectedStaff;
  const showPeriodFilter = activeTab !== "deals";
  const filterColumnCount = (showPeriodFilter ? 1 : 0) + 1 + (activeTabConfig.showStaffFilter ? 1 : 0);

  const replaceParams = useCallback(
    (updates: Record<string, string>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        params.set(key, value);
      }
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    let changed = false;
    const ensureParam = (key: string, value: string) => {
      if (params.get(key) !== value) {
        params.set(key, value);
        changed = true;
      }
    };

    ensureParam("tab", activeTab);
    ensureParam("period", selectedPeriod);
    ensureParam("product", selectedProduct);
    ensureParam("staff", selectedStaff);
    ensureParam("mode", activeMode);

    if (changed) router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [activeMode, activeTab, pathname, router, searchParams, selectedPeriod, selectedProduct, selectedStaff]);

  return (
    <div className="min-h-screen space-y-4 bg-slate-50 text-slate-950">
      <div className="rounded-md border bg-white shadow-sm">
        <div className="flex flex-col gap-3 p-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <div className="rounded-md bg-blue-700 px-2 py-1 text-sm font-bold text-white">STP</div>
              <div>
                <h1 className="text-xl font-bold tracking-normal text-slate-950">STPダッシュボード</h1>
                <p className="text-xs text-slate-500">STP OS / Sales & Operations</p>
              </div>
            </div>
          </div>
          <div className="overflow-x-auto lg:shrink-0 lg:overflow-visible">
            <div
              className={cn(
                "grid gap-3 lg:min-w-0",
                filterColumnCount === 3
                  ? "min-w-[680px] grid-cols-3 lg:w-[720px]"
                  : "min-w-[460px] grid-cols-2 lg:w-[480px]"
              )}
            >
              {showPeriodFilter && (
                <FilterSelect
                  icon={CalendarDays}
                  label="期間"
                  value={selectedPeriod}
                  onValueChange={(value) => replaceParams({ period: value })}
                  options={data.periodOptions}
                />
              )}
              <FilterSelect
                icon={Package}
                label="商材"
                value={selectedProduct}
                onValueChange={(value) => replaceParams({ product: value })}
                options={data.productOptions}
              />
              {activeTabConfig.showStaffFilter && (
                <FilterSelect
                  icon={User}
                  label="担当者"
                  value={selectedStaff}
                  onValueChange={(value) => replaceParams({ staff: value })}
                  options={[{ value: ALL_STAFF, label: "すべて" }, ...data.staffOptions]}
                />
              )}
            </div>
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(value) => replaceParams({ tab: value })} idBase="stp-new-dashboard">
        <div className="overflow-x-auto pb-1">
          <TabsList className="h-auto min-w-full justify-start gap-1 rounded-md bg-white p-1 shadow-sm">
            {DASHBOARD_TABS.map((tab) => {
              const Icon = tab.icon;
              return (
                <TabsTrigger key={tab.value} value={tab.value} className="min-h-9 gap-2 px-3 text-sm">
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </TabsTrigger>
              );
            })}
          </TabsList>
        </div>

        <TabsContent value="funnel" className="mt-3">
          <FunnelDashboard
            data={data}
            mode={activeMode}
            onModeChange={(mode) => replaceParams({ mode })}
            onTargetsSaved={() => router.refresh()}
          />
        </TabsContent>
        <TabsContent value="channel" className="mt-3">
          <ChannelAnalysisDashboard data={data.channelAnalysis} />
        </TabsContent>
        <TabsContent value="deals" className="mt-3">
          <DealManagementDashboard data={data.dealManagement} />
        </TabsContent>
        {DASHBOARD_TABS.filter((tab) => tab.value !== "funnel" && tab.value !== "channel" && tab.value !== "deals").map((tab) => (
          <TabsContent key={tab.value} value={tab.value} className="mt-3">
            <PlaceholderDashboard tab={tab} />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

function FilterSelect({
  icon: Icon,
  label,
  value,
  onValueChange,
  options,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  options: DashboardOption[];
}) {
  return (
    <div className="min-w-0 space-y-1">
      <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
        <Icon className="h-3.5 w-3.5 text-blue-700" />
        {label}
      </div>
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger className="h-9 w-full bg-white text-sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function FunnelDashboard({
  data,
  mode,
  onModeChange,
  onTargetsSaved,
}: {
  data: NewDashboardData;
  mode: DashboardMode;
  onModeChange: (mode: DashboardMode) => void;
  onTargetsSaved: () => void;
}) {
  const displayData = mode === "snapshot" ? data.snapshot.data : data.current;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-950">MA・SFA・契約ファネル</h2>
          <p className="text-sm text-slate-500">リード発生月を起点に、契約・失注までの進捗を追跡</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
          <TargetSettingsDialog data={data} onSaved={onTargetsSaved} />
          <div className="overflow-x-auto">
            <div className="grid min-w-[480px] grid-cols-3 rounded-md border bg-white p-1 shadow-sm">
              {FUNNEL_MODES.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  className={cn(
                    "h-9 rounded px-3 text-sm font-semibold transition",
                    mode === item.value ? "bg-blue-700 text-white" : "text-slate-600 hover:bg-slate-100"
                  )}
                  onClick={() => onModeChange(item.value)}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {mode === "snapshot" && !data.snapshot.exists ? (
        <EmptySnapshot targetMonth={data.snapshot.targetMonth} />
      ) : displayData ? (
        <>
          {mode === "snapshot" && data.snapshot.capturedAt && (
            <div className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-800">
              保存済み月末残高: {formatCapturedAt(data.snapshot.capturedAt)}
            </div>
          )}
          <CurrentFunnelView data={displayData} />
          {mode === "cohort" && <CohortView data={data} />}
        </>
      ) : (
        <EmptySnapshot targetMonth={data.snapshot.targetMonth} />
      )}
    </div>
  );
}

function CurrentFunnelView({ data }: { data: CurrentFunnelResult }) {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        {data.metrics.map((metric) => (
          <MetricCard key={metric.key} metric={metric} />
        ))}
      </div>
      <div className="grid gap-3 lg:grid-cols-3">
        {data.rates.map((rate) => (
          <RateCard key={rate.key} rate={rate} />
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-[1fr_1.15fr_0.9fr]">
        <DwellTimeCard data={data} />
        <LostReasonCard data={data} />
        <RuleCard />
      </div>
    </div>
  );
}

function TargetSettingsDialog({ data, onSaved }: { data: NewDashboardData; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<FunnelTargetValues>(data.targetContext.values);
  const [isPending, startTransition] = useTransition();

  const updateValue = (key: FunnelTargetMetricKey, value: string) => {
    setValues((current) => ({
      ...current,
      [key]: value === "" ? null : Number(value),
    }));
  };

  const openDialog = () => {
    setValues(data.targetContext.values);
    setOpen(true);
  };

  const handleSave = () => {
    startTransition(async () => {
      await saveDashboardFunnelTargets({
        targetMonth: data.targetContext.targetMonth,
        product: data.selectedProduct,
        staff: data.selectedStaff,
        values,
      });
      onSaved();
      setOpen(false);
    });
  };

  return (
    <>
      <Button type="button" variant="outline" size="sm" className="h-9 bg-white" onClick={openDialog}>
        <Target className="h-4 w-4" />
        目標設定
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent size="form">
          <DialogHeader>
            <DialogTitle>目標設定</DialogTitle>
            <DialogDescription>
              {data.targetContext.targetMonth} / {data.targetContext.productName} / {data.targetContext.staffName}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            {TARGET_FIELDS.map((field) => (
              <label key={field.key} className="space-y-1">
                <span className="text-sm font-semibold text-slate-700">{field.label}</span>
                <Input
                  type="number"
                  min={0}
                  step={1}
                  inputMode="numeric"
                  value={values[field.key] ?? ""}
                  onChange={(event) => updateValue(field.key, event.target.value)}
                  placeholder="未設定"
                />
              </label>
            ))}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
              キャンセル
            </Button>
            <Button type="button" onClick={handleSave} disabled={isPending}>
              <Save className="h-4 w-4" />
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function MetricCard({ metric }: { metric: FunnelMetric }) {
  const Icon = METRIC_ICONS[metric.key] ?? ClipboardList;
  return (
    <Card className="rounded-md border bg-white shadow-sm">
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className={cn("rounded-full border p-2", TONE_CLASSES[metric.tone])}>
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-blue-800">{metric.label}</p>
            <p className="text-xs text-slate-500">{metric.subLabel}</p>
          </div>
        </div>
        <div className="mt-4 text-2xl font-bold text-blue-700 tabular-nums">
          {formatCount(metric.value, metric.unit)}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 border-t pt-3 text-xs">
          <div>
            <p className="text-slate-500">目標</p>
            <p className="font-semibold text-slate-900 tabular-nums">
              {metric.target == null ? "未設定" : formatCount(metric.target, metric.unit)}
            </p>
          </div>
          <div>
            <p className="text-slate-500">ギャップ</p>
            <p className={cn("font-semibold tabular-nums", metric.gap == null ? "text-slate-400" : metric.gap >= 0 ? "text-emerald-700" : "text-red-700")}>
              {metric.gap == null ? "-" : formatSignedCount(metric.gap, metric.unit)}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function RateCard({ rate }: { rate: FunnelRate }) {
  return (
    <Card className="rounded-md border bg-white shadow-sm">
      <CardContent className="p-4">
        <p className="text-sm font-bold text-slate-900">{rate.label}</p>
        <div className="mt-2 text-3xl font-bold text-blue-700 tabular-nums">{formatRate(rate.value)}</div>
        <div className="mt-3 flex items-center justify-between border-t pt-2 text-xs text-slate-500">
          <span>分子 {rate.numerator}件</span>
          <span>分母 {rate.denominator}件</span>
        </div>
        <div className="mt-2 flex items-center justify-between border-t pt-2 text-xs">
          <span className="text-slate-500">前月 {formatRate(rate.previousValue ?? null)}</span>
          <span className={cn("font-semibold tabular-nums", rate.previousDiffPt == null ? "text-slate-400" : rate.previousDiffPt >= 0 ? "text-emerald-700" : "text-red-700")}>
            {formatPointDiff(rate.previousDiffPt ?? null)}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

function DwellTimeCard({ data }: { data: CurrentFunnelResult }) {
  const chartData = data.dwellTimes.map((row) => ({
    name: row.label,
    days: row.averageDays ?? 0,
    label: row.averageDays == null ? "-" : `${row.averageDays}日`,
  }));

  return (
    <Card className="rounded-md border bg-white shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">1. ステージ滞留日数</CardTitle>
        <CardDescription>平均日数 / 母集団: {data.scopeLabel}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[260px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} layout="vertical" margin={{ top: 4, right: 20, left: 96, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="name" width={96} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(value) => [`${Number(value).toFixed(1)}日`, "平均"]} />
              <Bar dataKey="days" fill="#2563eb" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-2 space-y-1 text-xs text-slate-500">
          {data.dwellTimes.map((row) => (
            <div key={row.label} className="flex justify-between gap-3">
              <span className="truncate">{row.label}</span>
              <span className="shrink-0 tabular-nums">
                {row.averageDays == null ? "-" : `${row.averageDays}日`} / {row.sampleCount}件
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function LostReasonCard({ data }: { data: CurrentFunnelResult }) {
  const reasons = data.lostReasons;
  const total = reasons.reduce((sum, item) => sum + item.count, 0);

  return (
    <Card className="rounded-md border bg-white shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <PieChartIcon className="h-4 w-4 text-blue-700" />
          2. 失注理由
        </CardTitle>
        <CardDescription>選択式失注理由の構成比</CardDescription>
      </CardHeader>
      <CardContent>
        {total === 0 ? (
          <div className="flex h-[260px] items-center justify-center rounded-md border border-dashed text-sm text-slate-400">
            失注データがありません
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-[220px_1fr]">
            <div className="h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={reasons} dataKey="count" nameKey="label" innerRadius={58} outerRadius={88} paddingAngle={2}>
                    {reasons.map((item, index) => (
                      <Cell key={item.label} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value, _name, item) => [`${value}件`, item.payload.label]} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-2">
              <div className="text-center md:text-left">
                <p className="text-xs text-slate-500">失注件数</p>
                <p className="text-2xl font-bold text-slate-900">{total}件</p>
              </div>
              {reasons.map((item, index) => (
                <div key={item.label} className="flex items-center justify-between gap-3 text-sm">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: PIE_COLORS[index % PIE_COLORS.length] }} />
                    <span className="truncate">{item.label}</span>
                  </div>
                  <span className="shrink-0 font-semibold tabular-nums">{item.count}件 ({item.percent.toFixed(1)}%)</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function CohortView({ data }: { data: NewDashboardData }) {
  return (
    <Card className="rounded-md border bg-white shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">3. リード発生月別成果</CardTitle>
        <CardDescription>選択月を含む直近5ヶ月 / ※当月発生と同値</CardDescription>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="w-full min-w-[820px] border-collapse text-sm">
          <thead>
            <tr className="bg-blue-900 text-white">
              {["リード発生月", "リード", "有効リード", "商談実施", "検討中", "契約", "失注", "有効化率", "商談化率", "契約率"].map((header) => (
                <th key={header} className="border border-blue-800 px-3 py-2 text-left font-semibold">{header}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.cohort.months.map((row) => (
              <tr key={row.month} className="odd:bg-white even:bg-blue-50/40">
                <td className="border px-3 py-2 font-semibold">{row.month}</td>
                <td className="border px-3 py-2 tabular-nums">{row.lead}</td>
                <td className="border px-3 py-2 tabular-nums">{row.validLead}</td>
                <td className="border px-3 py-2 tabular-nums">{row.meeting}</td>
                <td className="border px-3 py-2 tabular-nums">{row.pending}</td>
                <td className="border px-3 py-2 tabular-nums">{row.contract}</td>
                <td className="border px-3 py-2 tabular-nums">{row.lost}</td>
                <td className="border px-3 py-2 font-semibold text-blue-700 tabular-nums">{formatRate(row.validRate)}</td>
                <td className="border px-3 py-2 font-semibold text-blue-700 tabular-nums">{formatRate(row.meetingRate)}</td>
                <td className="border px-3 py-2 font-semibold text-blue-700 tabular-nums">{formatRate(row.contractRate)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

function RuleCard() {
  return (
    <Card className="rounded-md border bg-white shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">4. 定義ルール</CardTitle>
        <CardDescription>この画面の集計基準</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm text-slate-700">
        <RuleItem icon={CalendarDays} title="リード発生月起点" text="リード獲得日を母集団の起点にして追跡します。" />
        <RuleItem icon={Handshake} title="商談実施" text="接触種別「商談」の初回接触日時を1企業1件で数えます。" />
        <RuleItem icon={ClipboardList} title="契約" text="契約履歴の契約日が入力されている企業だけを契約判定に使います。" />
        <RuleItem icon={FileWarning} title="月末残高" text="毎月末22:00に保存されたスナップショットのみ表示します。" />
      </CardContent>
    </Card>
  );
}

function RuleItem({ icon: Icon, title, text }: { icon: React.ElementType; title: string; text: string }) {
  return (
    <div className="flex gap-3">
      <div className="mt-0.5 rounded-full bg-blue-100 p-1.5 text-blue-700">
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <p className="font-semibold text-slate-900">{title}</p>
        <p className="text-xs leading-relaxed text-slate-600">{text}</p>
      </div>
    </div>
  );
}

function ChannelAnalysisDashboard({ data }: { data: ChannelAnalysisData }) {
  return (
    <div className="space-y-4">
      <div className="rounded-md border border-cyan-200 bg-cyan-50 p-4">
        <div className="flex items-start gap-3">
          <div className="rounded-md border border-cyan-200 bg-white/80 p-2 text-cyan-700">
            <BarChart3 className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-950">チャネル分析</h2>
            <p className="text-sm text-slate-600">
              流入経路ごとのリード獲得、商談化、契約、月額MRRを比較します。
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        {data.summary.map((metric) => (
          <Card key={metric.key} className="rounded-md border bg-white shadow-sm">
            <CardContent className="p-4">
              <p className="text-sm font-bold text-slate-700">{metric.label}</p>
              <p className="mt-3 text-2xl font-bold text-blue-700 tabular-nums">
                {formatChannelMetric(metric.value, metric.format)}
              </p>
              {metric.note && <p className="mt-2 text-xs text-slate-500">{metric.note}</p>}
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="rounded-md border bg-white shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">チャネル別分析</CardTitle>
          <CardDescription>
            対象期間: {data.scopeLabel} / CACは開発中のため評価条件では達成扱い
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] border-collapse text-sm">
              <thead>
                <tr className="bg-blue-900 text-white">
                  {["流入経路", "リード数", "有効率", "商談化率", "契約率", "契約数", "獲得MRR", "MRR構成比", "CAC", "評価"].map((header) => (
                    <th key={header} className="border border-blue-800 px-3 py-2 text-left font-semibold">
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.rows.map((row) => (
                  <ChannelAnalysisTableRow key={row.leadSourceId} row={row} />
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-slate-500">
            流入経路未設定のリード: {data.unassignedLeadCount}件。チャネル別行には含めていません。
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <Card className="rounded-md border bg-white shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">商材別実績</CardTitle>
            <CardDescription>商材別の内訳</CardDescription>
          </CardHeader>
          <CardContent className="flex min-h-[220px] items-center justify-center rounded-b-md text-sm text-slate-400">
            開発中
          </CardContent>
        </Card>

        <Card className="rounded-md border bg-white shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">担当者別進捗</CardTitle>
            <CardDescription>担当営業ごとの商談・契約・新規MRR</CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full min-w-[680px] border-collapse text-sm">
              <thead>
                <tr className="bg-slate-100 text-slate-700">
                  {["担当者", "商談数", "契約数", "契約率", "新規MRR", "達成率"].map((header) => (
                    <th key={header} className="border px-3 py-2 text-left font-semibold">
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.staffProgress.map((row) => (
                  <tr key={row.staffId} className="odd:bg-white even:bg-slate-50">
                    <td className="border px-3 py-2 font-semibold">{row.staffName}</td>
                    <td className="border px-3 py-2 tabular-nums">{row.meetingCount}件</td>
                    <td className="border px-3 py-2 tabular-nums">{row.contractCount}件</td>
                    <td className="border px-3 py-2 font-semibold text-blue-700 tabular-nums">{formatRate(row.contractRate)}</td>
                    <td className="border px-3 py-2 font-semibold tabular-nums">{formatCurrency(row.newMrr)}</td>
                    <td className="border px-3 py-2 text-slate-500">{row.achievementLabel}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function ChannelAnalysisTableRow({ row }: { row: ChannelAnalysisRow }) {
  return (
    <tr className="odd:bg-white even:bg-blue-50/40">
      <td className="border px-3 py-2 font-semibold">{row.leadSourceName}</td>
      <td className="border px-3 py-2 tabular-nums">{row.leadCount}件</td>
      <td className="border px-3 py-2 font-semibold text-blue-700 tabular-nums">{formatRate(row.validRate)}</td>
      <td className="border px-3 py-2 font-semibold text-blue-700 tabular-nums">{formatRate(row.meetingRate)}</td>
      <td className="border px-3 py-2 font-semibold text-blue-700 tabular-nums">{formatRate(row.contractRate)}</td>
      <td className="border px-3 py-2 tabular-nums">{row.contractCount}件</td>
      <td className="border px-3 py-2 font-semibold tabular-nums">{formatCurrency(row.acquiredMrr)}</td>
      <td className="border px-3 py-2 tabular-nums">{formatRate(row.mrrShare)}</td>
      <td className="border px-3 py-2 text-slate-500">{row.cacLabel}</td>
      <td className="border px-3 py-2">
        <span className={cn("inline-flex h-7 min-w-7 items-center justify-center rounded-full px-2 text-xs font-bold", ratingClass(row.rating))}>
          {row.rating}
        </span>
      </td>
    </tr>
  );
}

function ratingClass(rating: ChannelAnalysisRow["rating"]) {
  switch (rating) {
    case "S":
      return "bg-blue-700 text-white";
    case "A":
      return "bg-emerald-100 text-emerald-700";
    case "B":
      return "bg-sky-100 text-sky-700";
    case "C":
      return "bg-amber-100 text-amber-700";
    case "D":
      return "bg-slate-100 text-slate-500";
  }
}

function DealManagementDashboard({ data }: { data: DealManagementData }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selectedCondition, setSelectedCondition] = useState<DealFocusCondition | null>(null);
  const pageSize = 10;

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return data.rows;
    return data.rows.filter((row) => row.searchText.includes(query));
  }, [data.rows, search]);
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageRows = filteredRows.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const modalRows = selectedCondition
    ? data.rows.filter((row) => selectedCondition.rowIds.includes(row.id))
    : [];

  const goToCompany = (id: number) => {
    router.push(`/stp/companies?highlight=${id}`);
  };

  return (
    <div className="space-y-4">
      <div className="rounded-md border border-amber-200 bg-amber-50 p-4">
        <div className="flex items-start gap-3">
          <div className="rounded-md border border-amber-200 bg-white/80 p-2 text-amber-700">
            <Briefcase className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-950">案件管理</h2>
            <p className="text-sm text-slate-600">
              担当営業: {data.staffLabel} / オープン案件と優先フォローをリアルタイムで確認します。
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        {data.summary.map((metric) => (
          <Card key={metric.key} className="rounded-md border bg-white shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-bold text-slate-700">{metric.label}</p>
                <span className={cn("h-2.5 w-2.5 rounded-full", dealToneClass(metric.tone))} />
              </div>
              <p className="mt-3 text-2xl font-bold text-blue-700 tabular-nums">
                {new Intl.NumberFormat("ja-JP").format(metric.value)}件
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <Card className="rounded-md border bg-white shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">ステージ別件数</CardTitle>
            <CardDescription>現在パイプラインの表示順</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.stageCounts.map((row) => (
              <div key={row.stageId} className="grid grid-cols-[1fr_auto] items-center gap-3 rounded border bg-slate-50 px-3 py-2 text-sm">
                <span className="truncate font-medium text-slate-700">{row.stageName}</span>
                <span className="font-bold text-blue-700 tabular-nums">{row.count}件</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="rounded-md border bg-white shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">優先フォロー条件</CardTitle>
            <CardDescription>カードを押すと該当案件を表示します</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            {data.focusConditions.map((condition) => (
              <button
                key={condition.key}
                type="button"
                className="rounded-md border bg-white p-3 text-left shadow-sm transition hover:border-blue-300 hover:bg-blue-50"
                onClick={() => setSelectedCondition(condition)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-bold text-slate-900">{condition.label}</p>
                    <p className="mt-1 text-xs leading-relaxed text-slate-500">{condition.description}</p>
                  </div>
                  <span className="shrink-0 rounded-full bg-red-100 px-2 py-1 text-sm font-bold text-red-700 tabular-nums">
                    {condition.count}件
                  </span>
                </div>
              </button>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-md border bg-white shadow-sm">
        <CardHeader className="pb-2">
          <div className="grid gap-3 lg:grid-cols-[1fr_320px] lg:items-center">
            <div>
              <CardTitle className="text-base">注力案件一覧</CardTitle>
              <CardDescription>優先度 高・中・低の順 / 10行ずつ表示</CardDescription>
            </div>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
                placeholder="企業名・代理店・担当者で検索"
                className="pl-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <DealRowsTable rows={pageRows} onGoToCompany={goToCompany} />
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-slate-500">
              {filteredRows.length}件中 {filteredRows.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}
              〜{Math.min(currentPage * pageSize, filteredRows.length)}件を表示
            </p>
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" size="sm" disabled={currentPage <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>
                <ChevronLeft className="h-4 w-4" />
                前へ
              </Button>
              <span className="text-sm font-semibold tabular-nums">{currentPage} / {totalPages}</span>
              <Button type="button" variant="outline" size="sm" disabled={currentPage >= totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))}>
                次へ
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!selectedCondition} onOpenChange={(open) => !open && setSelectedCondition(null)}>
        <DialogContent size="fullwidth" className="max-h-[88dvh] overflow-hidden p-0">
          <DialogHeader className="border-b px-5 py-4">
            <DialogTitle>{selectedCondition?.label}</DialogTitle>
            <DialogDescription>{selectedCondition?.description}</DialogDescription>
          </DialogHeader>
          <div className="min-h-0 overflow-auto p-5">
            <DealRowsTable rows={modalRows} onGoToCompany={goToCompany} />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DealRowsTable({ rows, onGoToCompany }: { rows: DealManagementRow[]; onGoToCompany: (id: number) => void }) {
  const headers = ["優先度", "リード獲得日", "有効状態", "初回商談日", "AS担当者", "担当営業", "企業名", "代理店", "流入経路", "業種", "パイプライン", "案件確度", "次に連絡する日", "操作"];

  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full min-w-[1420px] border-collapse text-sm">
        <thead>
          <tr className="bg-blue-900 text-white">
            {headers.map((header) => (
              <th key={header} className="border border-blue-800 px-3 py-2 text-left font-semibold">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={headers.length} className="border px-3 py-8 text-center text-slate-400">
                該当する案件がありません
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={row.id} className="odd:bg-white even:bg-blue-50/40">
                <td className="border px-3 py-2">
                  <span className={cn("inline-flex min-w-8 justify-center rounded-full px-2 py-1 text-xs font-bold", priorityClass(row.priority))}>
                    {row.priority}
                  </span>
                  {row.priorityReasons.length > 0 && (
                    <p className="mt-1 max-w-[160px] text-[11px] leading-snug text-slate-500">
                      {row.priorityReasons.join(" / ")}
                    </p>
                  )}
                </td>
                <td className="border px-3 py-2 tabular-nums">{formatDate(row.leadAcquiredDate)}</td>
                <td className="border px-3 py-2">{row.leadValidity ?? "-"}</td>
                <td className="border px-3 py-2 tabular-nums">{formatDate(row.firstMeetingDate)}</td>
                <td className="border px-3 py-2">{row.asStaffName ?? "-"}</td>
                <td className="border px-3 py-2">{row.salesStaffName ?? "-"}</td>
                <td className="border px-3 py-2 font-semibold text-slate-900">{row.companyName}</td>
                <td className="border px-3 py-2">{row.agentName ?? "-"}</td>
                <td className="border px-3 py-2">{row.leadSourceName ?? "-"}</td>
                <td className="border px-3 py-2">{row.industryLabel ?? "-"}</td>
                <td className="border px-3 py-2">{row.stageName ?? "-"}</td>
                <td className="border px-3 py-2 font-semibold tabular-nums">{row.dealProbability == null ? "-" : `${row.dealProbability}%`}</td>
                <td className="border px-3 py-2 tabular-nums">{formatDate(row.nextContactDate)}</td>
                <td className="border px-3 py-2">
                  <Button type="button" size="sm" variant="outline" onClick={() => onGoToCompany(row.id)}>
                    <ExternalLink className="h-4 w-4" />
                    企業情報ページへ
                  </Button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function priorityClass(priority: DealPriority) {
  switch (priority) {
    case "高":
      return "bg-red-100 text-red-700";
    case "中":
      return "bg-amber-100 text-amber-700";
    case "低":
      return "bg-slate-100 text-slate-600";
  }
}

function dealToneClass(tone: DealManagementData["summary"][number]["tone"]) {
  switch (tone) {
    case "blue":
      return "bg-blue-600";
    case "green":
      return "bg-emerald-600";
    case "orange":
      return "bg-orange-500";
    case "red":
      return "bg-red-600";
    case "purple":
      return "bg-violet-600";
    case "gray":
      return "bg-slate-500";
  }
}

function EmptySnapshot({ targetMonth }: { targetMonth: string }) {
  return (
    <Card className="rounded-md border bg-white shadow-sm">
      <CardContent className="flex min-h-[320px] flex-col items-center justify-center gap-3 p-8 text-center">
        <div className="rounded-full bg-slate-100 p-4 text-slate-500">
          <FileWarning className="h-8 w-8" />
        </div>
        <div>
          <p className="text-lg font-bold text-slate-900">スナップショット未作成</p>
          <p className="mt-1 text-sm text-slate-500">
            {targetMonth} の月末残高はまだ保存されていません。
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function PlaceholderDashboard({ tab }: { tab: DashboardTab }) {
  const Icon = tab.icon;
  return (
    <div className="space-y-4">
      <div className={cn("rounded-md border p-4", tab.accent)}>
        <div className="flex items-start gap-3">
          <div className="rounded-md border border-current/20 bg-white/70 p-2">
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-950">{tab.title}</h2>
            <p className="text-sm text-slate-600">{tab.description}</p>
          </div>
        </div>
      </div>
      <Card className="rounded-md border bg-white shadow-sm">
        <CardContent className="flex h-64 items-center justify-center text-sm text-slate-500">
          このダッシュボードの中身は次回以降に作成します
        </CardContent>
      </Card>
      <Badge variant="outline" className="border-slate-300 bg-white text-slate-600">枠組みのみ</Badge>
    </div>
  );
}
