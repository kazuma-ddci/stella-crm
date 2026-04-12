"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { DatePicker } from "@/components/ui/date-picker";
import { ArrowLeft, Calendar, Loader2 } from "lucide-react";
import { getMediaAdDetail, type AdDetail } from "./actions";
import { toast } from "sonner";

const STATUS_LABELS: Record<string, { label: string; variant: string }> = {
  active: { label: "配信中", variant: "bg-green-50 text-green-700 border-green-200" },
  ended: { label: "終了", variant: "bg-gray-50 text-gray-700 border-gray-200" },
  preparing: { label: "準備中", variant: "bg-blue-50 text-blue-700 border-blue-200" },
  paused: { label: "停止中", variant: "bg-yellow-50 text-yellow-700 border-yellow-200" },
};

function formatNumber(n: number): string {
  return n.toLocaleString("ja-JP");
}

function formatCurrency(n: number | null): string {
  if (n === null || n === 0) return "¥0";
  return `¥${n.toLocaleString("ja-JP")}`;
}

function formatRate(n: number | null): string {
  if (n === null) return "-";
  return `${n.toFixed(2)}%`;
}

export function AdDetailView({
  adId,
  onBack,
}: {
  adId: number;
  onBack: () => void;
}) {
  const [detail, setDetail] = useState<AdDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [filterMode, setFilterMode] = useState<"all" | "7d" | "30d" | "custom">("all");

  const fetchDetail = useCallback(async (from?: string, to?: string) => {
    setLoading(true);
    try {
      const result = await getMediaAdDetail(adId, from, to);
      if (result.ok) {
        setDetail(result.data);
      } else {
        toast.error(result.error);
      }
    } catch {
      toast.error("データの取得に失敗しました");
    } finally {
      setLoading(false);
    }
  }, [adId]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  const handleFilterChange = (mode: "all" | "7d" | "30d" | "custom") => {
    setFilterMode(mode);
    if (mode === "all") {
      setDateFrom("");
      setDateTo("");
      fetchDetail();
    } else if (mode === "7d") {
      const to = new Date();
      const from = new Date();
      from.setDate(from.getDate() - 7);
      const fromStr = from.toISOString().split("T")[0];
      const toStr = to.toISOString().split("T")[0];
      setDateFrom(fromStr);
      setDateTo(toStr);
      fetchDetail(fromStr, toStr);
    } else if (mode === "30d") {
      const to = new Date();
      const from = new Date();
      from.setDate(from.getDate() - 30);
      const fromStr = from.toISOString().split("T")[0];
      const toStr = to.toISOString().split("T")[0];
      setDateFrom(fromStr);
      setDateTo(toStr);
      fetchDetail(fromStr, toStr);
    }
  };

  const handleCustomFilter = () => {
    if (dateFrom && dateTo) {
      fetchDetail(dateFrom, dateTo);
    }
  };

  // サマリー計算（日別データから再計算）
  const summary = useMemo(() => {
    if (!detail) return null;
    const metrics = detail.dailyMetrics;
    const totalImpressions = metrics.reduce((s, m) => s + m.impressions, 0);
    const totalClicks = metrics.reduce((s, m) => s + m.clicks, 0);
    const totalApplications = metrics.reduce((s, m) => s + m.applications, 0);
    const totalCost = metrics.reduce((s, m) => s + m.cost, 0);
    const ctr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
    const cvr = totalClicks > 0 ? (totalApplications / totalClicks) * 100 : 0;
    const cpa = totalApplications > 0 ? Math.round(totalCost / totalApplications) : null;
    return { totalImpressions, totalClicks, totalApplications, totalCost, ctr, cvr, cpa };
  }, [detail]);

  if (loading && !detail) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!detail) return null;

  const statusInfo = STATUS_LABELS[detail.status] || STATUS_LABELS.active;

  return (
    <div className="space-y-6">
      {/* ヘッダ */}
      <div>
        <Button variant="ghost" size="sm" onClick={onBack} className="mb-2">
          <ArrowLeft className="mr-1 h-4 w-4" />
          広告一覧に戻る
        </Button>
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-bold">
            {detail.adName}
            <span className="ml-2 text-sm font-normal text-gray-500">
              #{detail.adNumber}
            </span>
          </h2>
          <Badge variant="outline" className={statusInfo.variant}>
            {statusInfo.label}
          </Badge>
        </div>
        <div className="mt-1 text-sm text-gray-500 flex gap-4">
          {detail.contractJobMedia && <span>媒体: {detail.contractJobMedia}</span>}
          {detail.startDate && <span>開始: {detail.startDate}</span>}
          {detail.endDate && <span>終了: {detail.endDate}</span>}
          {detail.budgetLimit && <span>予算上限: {formatCurrency(detail.budgetLimit)}</span>}
        </div>
      </div>

      {/* 期間フィルタ */}
      <div className="flex flex-wrap items-center gap-2">
        <Calendar className="h-4 w-4 text-gray-500" />
        <span className="text-sm text-gray-600">期間:</span>
        <div className="flex gap-1">
          {(["all", "7d", "30d", "custom"] as const).map((mode) => (
            <Button
              key={mode}
              variant={filterMode === mode ? "default" : "outline"}
              size="sm"
              onClick={() => handleFilterChange(mode)}
            >
              {mode === "all" ? "全期間" : mode === "7d" ? "直近7日" : mode === "30d" ? "直近30日" : "カスタム"}
            </Button>
          ))}
        </div>
        {filterMode === "custom" && (
          <div className="flex items-center gap-2">
            <DatePicker value={dateFrom} onChange={setDateFrom} placeholder="開始日" />
            <span>〜</span>
            <DatePicker value={dateTo} onChange={setDateTo} placeholder="終了日" />
            <Button size="sm" onClick={handleCustomFilter} disabled={!dateFrom || !dateTo}>
              適用
            </Button>
          </div>
        )}
      </div>

      {/* サマリーカード */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Card>
            <CardContent className="pt-4 pb-3 px-4">
              <div className="text-xs text-gray-500">表示数</div>
              <div className="text-xl font-bold">{formatNumber(summary.totalImpressions)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 px-4">
              <div className="text-xs text-gray-500">クリック数</div>
              <div className="text-xl font-bold">{formatNumber(summary.totalClicks)}</div>
              <div className="text-xs text-gray-400">CTR: {summary.ctr.toFixed(2)}%</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 px-4">
              <div className="text-xs text-gray-500">応募数</div>
              <div className="text-xl font-bold">{formatNumber(summary.totalApplications)}</div>
              <div className="text-xs text-gray-400">CVR: {summary.cvr.toFixed(2)}%</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 px-4">
              <div className="text-xs text-gray-500">応募単価 (CPA)</div>
              <div className="text-xl font-bold">
                {summary.cpa !== null ? formatCurrency(summary.cpa) : "-"}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 px-4">
              <div className="text-xs text-gray-500">利用済予算</div>
              <div className="text-xl font-bold">{formatCurrency(summary.totalCost)}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* データテーブル */}
      <Tabs defaultValue="daily">
        <TabsList>
          <TabsTrigger value="daily">日別データ ({detail.dailyMetrics.length}件)</TabsTrigger>
          <TabsTrigger value="jobs">求人別データ ({detail.jobPostings.length}件)</TabsTrigger>
        </TabsList>

        <TabsContent value="daily" className="mt-4">
          {detail.dailyMetrics.length === 0 ? (
            <p className="text-gray-500 text-sm py-8 text-center">日別データがありません</p>
          ) : (
            <div className="border rounded-lg overflow-auto max-h-[500px]">
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-white">
                  <TableRow>
                    <TableHead className="min-w-[100px]">配信日</TableHead>
                    <TableHead className="text-right min-w-[80px]">表示数</TableHead>
                    <TableHead className="text-right min-w-[70px]">CTR</TableHead>
                    <TableHead className="text-right min-w-[80px]">クリック数</TableHead>
                    <TableHead className="text-right min-w-[70px]">応募数</TableHead>
                    <TableHead className="text-right min-w-[70px]">応募率</TableHead>
                    <TableHead className="text-right min-w-[90px]">クリック単価</TableHead>
                    <TableHead className="text-right min-w-[80px]">応募単価</TableHead>
                    <TableHead className="text-right min-w-[100px]">利用済予算</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detail.dailyMetrics.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell className="font-medium">{m.date}</TableCell>
                      <TableCell className="text-right">{formatNumber(m.impressions)}</TableCell>
                      <TableCell className="text-right">{formatRate(m.ctr)}</TableCell>
                      <TableCell className="text-right">{formatNumber(m.clicks)}</TableCell>
                      <TableCell className="text-right">{formatNumber(m.applications)}</TableCell>
                      <TableCell className="text-right">{formatRate(m.applicationRate)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(m.cpc)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(m.cpa)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(m.cost)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="jobs" className="mt-4">
          {detail.jobPostings.length === 0 ? (
            <p className="text-gray-500 text-sm py-8 text-center">求人データがありません</p>
          ) : (
            <div className="border rounded-lg overflow-auto max-h-[500px]">
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-white">
                  <TableRow>
                    <TableHead className="min-w-[80px]">求人番号</TableHead>
                    <TableHead className="min-w-[200px]">求人タイトル</TableHead>
                    <TableHead className="text-right min-w-[80px]">表示数</TableHead>
                    <TableHead className="text-right min-w-[70px]">CTR</TableHead>
                    <TableHead className="text-right min-w-[80px]">クリック数</TableHead>
                    <TableHead className="text-right min-w-[70px]">応募数</TableHead>
                    <TableHead className="text-right min-w-[70px]">応募率</TableHead>
                    <TableHead className="text-right min-w-[90px]">クリック単価</TableHead>
                    <TableHead className="text-right min-w-[80px]">応募単価</TableHead>
                    <TableHead className="text-right min-w-[100px]">利用済予算</TableHead>
                    <TableHead className="min-w-[70px]">雇用形態</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detail.jobPostings.map((jp) => (
                    <TableRow key={jp.id}>
                      <TableCell className="font-mono text-xs">{jp.jobNumber}</TableCell>
                      <TableCell className="max-w-[300px] truncate" title={jp.jobTitle}>
                        {jp.jobTitle}
                      </TableCell>
                      <TableCell className="text-right">{formatNumber(jp.impressions)}</TableCell>
                      <TableCell className="text-right">{formatRate(jp.ctr)}</TableCell>
                      <TableCell className="text-right">{formatNumber(jp.clicks)}</TableCell>
                      <TableCell className="text-right">{formatNumber(jp.applications)}</TableCell>
                      <TableCell className="text-right">{formatRate(jp.applicationRate)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(jp.cpc)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(jp.cpa)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(jp.cost)}</TableCell>
                      <TableCell>{jp.employmentType || "-"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
