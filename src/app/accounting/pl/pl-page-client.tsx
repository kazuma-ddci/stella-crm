"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Lock, LockOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { closePlMonth, reopenPlMonth, type PlPageData } from "./actions";
import {
  normalizePlAggregationUnit,
  normalizePlAllocationView,
  normalizePlAmountBasis,
  normalizePlPeriodType,
  normalizePlReportMode,
  PL_CATEGORY_ORDER,
} from "@/lib/accounting/pl-report";

type Props = {
  initialParams: Record<string, string | undefined>;
  data: PlPageData;
};

const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: 7 }, (_, i) => CURRENT_YEAR - 3 + i);
const MONTH_OPTIONS = Array.from({ length: 12 }, (_, i) => i + 1);

function formatCurrency(amount: number) {
  const prefix = amount < 0 ? "-¥" : "¥";
  return `${prefix}${Math.abs(amount).toLocaleString()}`;
}

export function PlPageClient({ initialParams, data }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [reopenReason, setReopenReason] = useState("");

  const reportMode = normalizePlReportMode(initialParams.reportMode);
  const aggregationUnit = normalizePlAggregationUnit(initialParams.aggregationUnit);
  const allocationView = normalizePlAllocationView(initialParams.allocationView);
  const periodType = normalizePlPeriodType(initialParams.periodType);
  const amountBasis = normalizePlAmountBasis(initialParams.amountBasis);
  const year = initialParams.year ?? String(CURRENT_YEAR);
  const month = initialParams.month ?? String(new Date().getMonth() + 1);
  const operatingCompanyId =
    initialParams.operatingCompanyId ?? (data.selectedCompanyId ? String(data.selectedCompanyId) : "");
  const projectId =
    initialParams.projectId ?? (data.selectedProjectId ? String(data.selectedProjectId) : "");

  const updateUrl = (patch: Record<string, string>) => {
    const nextParams = {
      reportMode,
      aggregationUnit,
      allocationView,
      periodType,
      amountBasis,
      year,
      month,
      operatingCompanyId,
      projectId,
      ...patch,
    };
    const params = new URLSearchParams();
    Object.entries(nextParams).forEach(([key, value]) => {
      if (value) params.set(key, value);
    });
    router.push(`/accounting/pl?${params.toString()}`);
  };

  const handleClose = () => {
    if (!data.selectedCompanyId) return;
    startTransition(async () => {
      const result = await closePlMonth({
        operatingCompanyId: data.selectedCompanyId!,
        year: Number(year),
        month: Number(month),
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("月次締めを実行しました");
      router.refresh();
    });
  };

  const handleReopen = () => {
    if (!data.selectedCompanyId) return;
    startTransition(async () => {
      const result = await reopenPlMonth({
        operatingCompanyId: data.selectedCompanyId!,
        year: Number(year),
        month: Number(month),
        reason: reopenReason,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("月次締めを解除しました");
      setReopenReason("");
      router.refresh();
    });
  };

  const categoryTotals = data.rows.reduce<Record<string, number>>((acc, row) => {
    acc[row.category] = (acc[row.category] ?? 0) + row.amount;
    return acc;
  }, {});

  return (
    <div className="space-y-5">
      <Card>
        <CardContent className="pt-6">
          <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-[minmax(120px,1fr)_minmax(120px,1fr)_minmax(120px,1fr)_minmax(120px,1fr)_minmax(120px,1fr)_minmax(240px,2fr)]">
            <div className="min-w-0">
              <Label className="text-xs text-muted-foreground">表示種別</Label>
              <Select value={reportMode} onValueChange={(v) => updateUrl({ reportMode: v })}>
                <SelectTrigger className="mt-1 w-full min-w-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="statutory">決算提出用</SelectItem>
                  <SelectItem value="internal">社内用</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-0">
              <Label className="text-xs text-muted-foreground">集計単位</Label>
              <Select
                value={aggregationUnit}
                onValueChange={(v) => updateUrl({ aggregationUnit: v, projectId: "" })}
              >
                <SelectTrigger className="mt-1 w-full min-w-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="company">法人別</SelectItem>
                  <SelectItem value="project">プロジェクト別</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-0">
              <Label className="text-xs text-muted-foreground">表示方式</Label>
              <Select value={allocationView} onValueChange={(v) => updateUrl({ allocationView: v })}>
                <SelectTrigger className="mt-1 w-full min-w-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="before">配賦前</SelectItem>
                  <SelectItem value="after">配賦後</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-0">
              <Label className="text-xs text-muted-foreground">期間</Label>
              <Select value={periodType} onValueChange={(v) => updateUrl({ periodType: v })}>
                <SelectTrigger className="mt-1 w-full min-w-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">月次</SelectItem>
                  <SelectItem value="fiscalYear">年度</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-0">
              <Label className="text-xs text-muted-foreground">金額</Label>
              <Select value={amountBasis} onValueChange={(v) => updateUrl({ amountBasis: v })}>
                <SelectTrigger className="mt-1 w-full min-w-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="taxExcluded">税抜</SelectItem>
                  <SelectItem value="taxIncluded">税込</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-0">
              {aggregationUnit === "project" ? (
                <>
                  <Label className="text-xs text-muted-foreground">プロジェクト</Label>
                  <Select value={projectId || "none"} onValueChange={(v) => updateUrl({ projectId: v })}>
                    <SelectTrigger className="mt-1 w-full min-w-0">
                      <SelectValue className="truncate" />
                    </SelectTrigger>
                    <SelectContent className="max-w-[min(420px,calc(100vw-2rem))]">
                      {data.projects.map((project) => (
                        <SelectItem key={project.id} value={String(project.id)} className="truncate">
                          {project.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </>
              ) : (
                <>
                  <Label className="text-xs text-muted-foreground">運営法人</Label>
                  <Select
                    value={operatingCompanyId || "none"}
                    onValueChange={(v) => updateUrl({ operatingCompanyId: v })}
                  >
                    <SelectTrigger className="mt-1 w-full min-w-0">
                      <SelectValue className="truncate" />
                    </SelectTrigger>
                    <SelectContent className="max-w-[min(420px,calc(100vw-2rem))]">
                      {data.companies.map((company) => (
                        <SelectItem key={company.id} value={String(company.id)} className="truncate">
                          {company.companyName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </>
              )}
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-end gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">年</Label>
              <Select value={year} onValueChange={(v) => updateUrl({ year: v })}>
                <SelectTrigger className="mt-1 w-[120px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {YEAR_OPTIONS.map((option) => (
                    <SelectItem key={option} value={String(option)}>
                      {option}年
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {periodType === "monthly" && (
              <div>
                <Label className="text-xs text-muted-foreground">月</Label>
                <Select value={month} onValueChange={(v) => updateUrl({ month: v })}>
                  <SelectTrigger className="mt-1 w-[100px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MONTH_OPTIONS.map((option) => (
                      <SelectItem key={option} value={String(option)}>
                        {option}月
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="ml-auto flex items-end gap-2">
              <div className="text-sm text-muted-foreground">
                {data.periodLabel}
                {data.isClosed ? " / 締め済み" : " / 未締め"}
              </div>
              {data.isClosed ? (
                <>
                  <Input
                    value={reopenReason}
                    onChange={(e) => setReopenReason(e.target.value)}
                    placeholder="解除理由"
                    className="w-48"
                  />
                  <Button variant="outline" onClick={handleReopen} disabled={isPending}>
                    <LockOpen className="mr-1 h-4 w-4" />
                    締め解除
                  </Button>
                </>
              ) : (
                <Button variant="outline" onClick={handleClose} disabled={isPending || periodType !== "monthly"}>
                  <Lock className="mr-1 h-4 w-4" />
                  月次締め
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-5">
            <div className="text-sm text-muted-foreground">売上高</div>
            <div className="text-xl font-semibold">{formatCurrency(data.totals.revenue)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="text-sm text-muted-foreground">粗利</div>
            <div className="text-xl font-semibold">{formatCurrency(data.totals.grossProfit)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="text-sm text-muted-foreground">営業利益</div>
            <div className="text-xl font-semibold">{formatCurrency(data.totals.operatingProfit)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="text-sm text-muted-foreground">当期利益</div>
            <div className="text-xl font-semibold">{formatCurrency(data.totals.netProfit)}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">P/L明細</CardTitle>
        </CardHeader>
        <CardContent>
          {data.rows.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              対象期間のP/Lデータがありません。
            </p>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50 text-left">
                    <th className="px-3 py-2 font-medium">
                      {aggregationUnit === "company" ? "法人" : "プロジェクト"}
                    </th>
                    <th className="px-3 py-2 font-medium">区分</th>
                    <th className="px-3 py-2 font-medium">勘定科目</th>
                    <th className="px-3 py-2 text-right font-medium">金額</th>
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((row) => (
                    <tr key={`${row.entityName}:${row.category}:${row.accountId}`} className="border-b">
                      <td className="px-3 py-2">{row.entityName}</td>
                      <td className="px-3 py-2">{row.categoryLabel}</td>
                      <td className="px-3 py-2">
                        {row.accountCode} {row.accountName}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {formatCurrency(row.amount)}
                      </td>
                    </tr>
                  ))}
                  {Object.entries(categoryTotals)
                    .sort(([a], [b]) => {
                      const orderA = PL_CATEGORY_ORDER[a as keyof typeof PL_CATEGORY_ORDER] ?? 999;
                      const orderB = PL_CATEGORY_ORDER[b as keyof typeof PL_CATEGORY_ORDER] ?? 999;
                      return orderA - orderB;
                    })
                    .map(([category, amount]) => (
                      <tr key={category} className="border-t bg-muted/30 font-medium">
                        <td className="px-3 py-2" colSpan={3}>
                          {data.rows.find((row) => row.category === category)?.categoryLabel} 合計
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {formatCurrency(amount)}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
