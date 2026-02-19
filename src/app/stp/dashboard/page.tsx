import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Building2,
  Users,
  FileCheck,
  TrendingUp,
  Target,
  ArrowRight,
  ClipboardList,
  BarChart3,
  MousePointerClick,
  Eye,
  Send,
} from "lucide-react";

export default async function StpDashboardPage() {
  const now = new Date();
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const currentMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  const [
    stpCompaniesCount,
    activeContractsCount,
    cancelledContractsCount,
    agentsCount,
    newLeadsThisMonth,
    activeContracts,
    newContractsThisMonth,
    companiesByStage,
    companiesByForecast,
    submissionCounts,
    companiesByLeadSource,
    kpiWeeklyDataThisMonth,
    recentStageChanges,
  ] = await Promise.all([
    // STP企業数（合計）
    prisma.stpCompany.count(),

    // アクティブ契約数
    prisma.stpContractHistory.count({
      where: { deletedAt: null, status: "active" },
    }),

    // 解約契約数
    prisma.stpContractHistory.count({
      where: { deletedAt: null, status: "cancelled" },
    }),

    // 代理店数
    prisma.stpAgent.count(),

    // 今月の新規リード数
    prisma.stpCompany.count({
      where: {
        leadAcquiredDate: {
          gte: currentMonthStart,
          lte: currentMonthEnd,
        },
      },
    }),

    // アクティブ契約のmonthlyFee合計（ARR算出用）
    prisma.stpContractHistory.findMany({
      where: { deletedAt: null, status: "active" },
      select: { monthlyFee: true },
    }),

    // 今月の新規契約数
    prisma.stpContractHistory.count({
      where: {
        deletedAt: null,
        contractStartDate: {
          gte: currentMonthStart,
          lte: currentMonthEnd,
        },
      },
    }),

    // ステージ別企業数
    prisma.stpCompany.groupBy({
      by: ["currentStageId"],
      _count: { id: true },
    }),

    // ヨミ別企業数
    prisma.stpCompany.groupBy({
      by: ["forecast"],
      _count: { id: true },
    }),

    // フォーム回答数（status別）
    prisma.stpLeadFormSubmission.groupBy({
      by: ["status"],
      _count: { id: true },
    }),

    // 流入経路別リード数
    prisma.stpCompany.groupBy({
      by: ["leadSourceId"],
      _count: { id: true },
      where: { leadSourceId: { not: null } },
    }),

    // 今月のKPIウィークリーデータ（運用KPI集計用）
    prisma.stpKpiWeeklyData.findMany({
      where: {
        weekStartDate: { gte: currentMonthStart },
        weekEndDate: { lte: currentMonthEnd },
      },
      select: {
        actualImpressions: true,
        actualClicks: true,
        actualApplications: true,
        actualCost: true,
      },
    }),

    // 直近のステージ変更
    prisma.stpStageHistory.findMany({
      where: { isVoided: false },
      take: 5,
      orderBy: { recordedAt: "desc" },
      include: {
        stpCompany: {
          include: { company: true },
        },
        fromStage: true,
        toStage: true,
      },
    }),
  ]);

  // ステージ名の取得
  const stageIds = companiesByStage
    .map((s) => s.currentStageId)
    .filter((id): id is number => id !== null);
  const stages = await prisma.stpStage.findMany({
    where: { id: { in: stageIds } },
    orderBy: { displayOrder: "asc" },
  });
  const stageMap = new Map(stages.map((s) => [s.id, s]));

  // 流入経路名の取得
  const leadSourceIds = companiesByLeadSource
    .map((s) => s.leadSourceId)
    .filter((id): id is number => id !== null);
  const leadSources = await prisma.stpLeadSource.findMany({
    where: { id: { in: leadSourceIds } },
  });
  const leadSourceMap = new Map(leadSources.map((s) => [s.id, s.name]));

  // ARR計算
  const totalMonthlyFee = activeContracts.reduce(
    (sum, c) => sum + (c.monthlyFee || 0),
    0
  );
  const arrEstimate = totalMonthlyFee * 12;

  // GRR計算
  const totalContracts = activeContractsCount + cancelledContractsCount;
  const grrPercent =
    totalContracts > 0
      ? Math.round((activeContractsCount / totalContracts) * 100)
      : null;

  // ステージ別データ（表示順でソート）
  const pipelineData = companiesByStage
    .filter((s) => s.currentStageId !== null)
    .map((s) => ({
      stageId: s.currentStageId!,
      stageName: stageMap.get(s.currentStageId!)?.name || "不明",
      stageType: stageMap.get(s.currentStageId!)?.stageType || "progress",
      displayOrder: stageMap.get(s.currentStageId!)?.displayOrder ?? 999,
      count: s._count.id,
    }))
    .sort((a, b) => a.displayOrder - b.displayOrder);

  const maxPipelineCount = Math.max(...pipelineData.map((d) => d.count), 1);

  // ヨミ別データ
  const forecastLabels: Record<string, string> = {
    MIN: "MIN",
    "落とし": "落とし",
    MAX: "MAX",
    "来月": "来月",
    "辞退": "辞退",
  };
  const forecastData = companiesByForecast
    .filter((f) => f.forecast !== null)
    .map((f) => ({
      forecast: f.forecast!,
      label: forecastLabels[f.forecast!] || f.forecast!,
      count: f._count.id,
    }));
  const noForecastCount = companiesByForecast.find(
    (f) => f.forecast === null
  )?._count.id;

  // フォーム回答数
  const submissionTotal = submissionCounts.reduce(
    (sum, s) => sum + s._count.id,
    0
  );
  const submissionPending =
    submissionCounts.find((s) => s.status === "pending")?._count.id || 0;
  const submissionProcessed =
    submissionCounts.find((s) => s.status === "processed")?._count.id || 0;

  // 流入経路別データ
  const leadSourceData = companiesByLeadSource
    .filter((s) => s.leadSourceId !== null)
    .map((s) => ({
      name: leadSourceMap.get(s.leadSourceId!) || "不明",
      count: s._count.id,
    }))
    .sort((a, b) => b.count - a.count);

  // 運用KPI集計（今月）
  const kpiTotals = kpiWeeklyDataThisMonth.reduce(
    (acc, d) => ({
      impressions: acc.impressions + (d.actualImpressions || 0),
      clicks: acc.clicks + (d.actualClicks || 0),
      applications: acc.applications + (d.actualApplications || 0),
      cost: acc.cost + (d.actualCost || 0),
    }),
    { impressions: 0, clicks: 0, applications: 0, cost: 0 }
  );

  // ステージタイプ別の色
  const stageTypeColor: Record<string, string> = {
    progress: "bg-blue-500",
    closed_won: "bg-green-500",
    closed_lost: "bg-red-400",
    pending: "bg-yellow-500",
  };

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("ja-JP").format(value);

  const formatDate = (date: Date) =>
    new Date(date).toLocaleDateString("ja-JP", { timeZone: "Asia/Tokyo" });

  const formatDateTime = (date: Date) =>
    new Date(date).toLocaleString("ja-JP", {
      timeZone: "Asia/Tokyo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });

  return (
    <div className="space-y-6">
      <h1 className="text-xl sm:text-2xl font-bold">STP ダッシュボード</h1>

      {/* === 概要カード === */}
      <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">STP企業数</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stpCompaniesCount}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              アクティブ契約数
            </CardTitle>
            <FileCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeContractsCount}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">代理店数</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{agentsCount}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              今月の新規リード
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{newLeadsThisMonth}</div>
          </CardContent>
        </Card>
      </div>

      {/* === 全社KPI === */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            全社KPI（経営進捗）
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:gap-4 sm:grid-cols-3">
            <div className="rounded-lg border p-4">
              <p className="text-sm text-muted-foreground">ARR（概算）</p>
              <p className="mt-1 text-2xl font-bold">
                ¥{formatCurrency(arrEstimate)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                月額合計 ¥{formatCurrency(totalMonthlyFee)} × 12
              </p>
            </div>
            <div className="rounded-lg border p-4">
              <p className="text-sm text-muted-foreground">
                今月の新規契約数
              </p>
              <p className="mt-1 text-2xl font-bold">{newContractsThisMonth}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {now.getMonth() + 1}月に開始した契約
              </p>
            </div>
            <div className="rounded-lg border p-4">
              <p className="text-sm text-muted-foreground">GRR（概算）</p>
              <p className="mt-1 text-2xl font-bold">
                {grrPercent !== null ? `${grrPercent}%` : "-"}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                アクティブ {activeContractsCount} / 合計 {totalContracts}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* === 商談パイプライン & ヨミ分布 === */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* 商談パイプライン */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              商談パイプライン
            </CardTitle>
          </CardHeader>
          <CardContent>
            {pipelineData.length === 0 ? (
              <p className="text-sm text-muted-foreground">データなし</p>
            ) : (
              <div className="space-y-3">
                {pipelineData.map((d) => (
                  <div key={d.stageId}>
                    <div className="mb-1 flex items-center justify-between">
                      <span className="text-sm font-medium">
                        {d.stageName}
                      </span>
                      <span className="text-sm font-bold">{d.count}社</span>
                    </div>
                    <div className="h-3 w-full rounded-full bg-gray-100">
                      <div
                        className={`h-3 rounded-full ${stageTypeColor[d.stageType] || "bg-blue-500"}`}
                        style={{
                          width: `${(d.count / maxPipelineCount) * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ヨミ分布 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              ヨミ分布
            </CardTitle>
          </CardHeader>
          <CardContent>
            {forecastData.length === 0 && !noForecastCount ? (
              <p className="text-sm text-muted-foreground">データなし</p>
            ) : (
              <div className="space-y-2">
                {forecastData.map((f) => (
                  <div
                    key={f.forecast}
                    className="flex items-center justify-between rounded-lg border px-4 py-2"
                  >
                    <span className="text-sm font-medium">{f.label}</span>
                    <span className="text-sm font-bold">{f.count}社</span>
                  </div>
                ))}
                {noForecastCount && noForecastCount > 0 && (
                  <div className="flex items-center justify-between rounded-lg border px-4 py-2 text-muted-foreground">
                    <span className="text-sm">未設定</span>
                    <span className="text-sm">{noForecastCount}社</span>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* === リード獲得 & 運用KPI === */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* リード獲得 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5" />
              リード獲得
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* フォーム回答 */}
            <div>
              <p className="mb-2 text-sm font-medium text-muted-foreground">
                フォーム回答
              </p>
              <div className="grid grid-cols-3 gap-1 sm:gap-2">
                <div className="rounded-lg border p-3 text-center">
                  <p className="text-xs text-muted-foreground">合計</p>
                  <p className="text-lg font-bold">{submissionTotal}</p>
                </div>
                <div className="rounded-lg border p-3 text-center">
                  <p className="text-xs text-muted-foreground">未処理</p>
                  <p className="text-lg font-bold text-yellow-600">
                    {submissionPending}
                  </p>
                </div>
                <div className="rounded-lg border p-3 text-center">
                  <p className="text-xs text-muted-foreground">処理済</p>
                  <p className="text-lg font-bold text-green-600">
                    {submissionProcessed}
                  </p>
                </div>
              </div>
            </div>

            {/* 流入経路別 */}
            {leadSourceData.length > 0 && (
              <div>
                <p className="mb-2 text-sm font-medium text-muted-foreground">
                  流入経路別
                </p>
                <div className="space-y-1">
                  {leadSourceData.map((ls) => (
                    <div
                      key={ls.name}
                      className="flex items-center justify-between rounded px-2 py-1 text-sm"
                    >
                      <span>{ls.name}</span>
                      <span className="font-medium">{ls.count}社</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 運用KPI集計 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              運用KPI集計（今月）
            </CardTitle>
          </CardHeader>
          <CardContent>
            {kpiWeeklyDataThisMonth.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                今月のKPIデータなし
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border p-3">
                  <div className="flex items-center gap-2">
                    <Eye className="h-4 w-4 text-muted-foreground" />
                    <p className="text-xs text-muted-foreground">表示回数</p>
                  </div>
                  <p className="mt-1 text-lg font-bold">
                    {formatCurrency(kpiTotals.impressions)}
                  </p>
                </div>
                <div className="rounded-lg border p-3">
                  <div className="flex items-center gap-2">
                    <MousePointerClick className="h-4 w-4 text-muted-foreground" />
                    <p className="text-xs text-muted-foreground">クリック数</p>
                  </div>
                  <p className="mt-1 text-lg font-bold">
                    {formatCurrency(kpiTotals.clicks)}
                  </p>
                </div>
                <div className="rounded-lg border p-3">
                  <div className="flex items-center gap-2">
                    <Send className="h-4 w-4 text-muted-foreground" />
                    <p className="text-xs text-muted-foreground">応募数</p>
                  </div>
                  <p className="mt-1 text-lg font-bold">
                    {formatCurrency(kpiTotals.applications)}
                  </p>
                </div>
                <div className="rounded-lg border p-3">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    <p className="text-xs text-muted-foreground">費用合計</p>
                  </div>
                  <p className="mt-1 text-lg font-bold">
                    ¥{formatCurrency(kpiTotals.cost)}
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* === 最近のステージ変更 === */}
      <Card>
        <CardHeader>
          <CardTitle>最近のパイプライン変更</CardTitle>
        </CardHeader>
        <CardContent>
          {recentStageChanges.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              パイプライン変更履歴がありません
            </p>
          ) : (
            <div className="space-y-4">
              {recentStageChanges.map((change) => (
                <div
                  key={change.id}
                  className="flex items-center justify-between border-b pb-4 last:border-0"
                >
                  <div className="flex-1">
                    <p className="font-medium">
                      {change.stpCompany.company.name}
                    </p>
                    <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                      <span>{change.fromStage?.name || "-"}</span>
                      <ArrowRight className="h-3 w-3" />
                      <span className="font-medium text-foreground">
                        {change.toStage?.name || "-"}
                      </span>
                      {change.note && (
                        <span className="ml-2 text-xs">({change.note})</span>
                      )}
                    </div>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {formatDateTime(change.recordedAt)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
