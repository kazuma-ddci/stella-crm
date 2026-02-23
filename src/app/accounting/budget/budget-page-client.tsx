"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { BudgetInputTable } from "./budget-input-table";
import { BudgetVsActualTable } from "./budget-vs-actual-table";
import type { BudgetFormData, BudgetRow, BudgetVsActualRow } from "./actions";

type Props = {
  budgets: BudgetRow[];
  budgetVsActual: BudgetVsActualRow[];
  formData: BudgetFormData;
  fiscalYear: number;
  costCenterId: number | null | undefined;
};

const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: 5 }, (_, i) => CURRENT_YEAR - 2 + i);

const MONTHS = [
  "1月", "2月", "3月", "4月", "5月", "6月",
  "7月", "8月", "9月", "10月", "11月", "12月",
];

export function BudgetPageClient({
  budgets,
  budgetVsActual,
  formData,
  fiscalYear,
  costCenterId,
}: Props) {
  const router = useRouter();
  const [selectedYear, setSelectedYear] = useState(fiscalYear.toString());
  const [selectedCostCenter, setSelectedCostCenter] = useState(
    costCenterId === null ? "all" : costCenterId === undefined ? "any" : costCenterId.toString()
  );
  const [selectedMonth, setSelectedMonth] = useState("all");

  const handleFilterChange = (year: string, cc: string) => {
    const params = new URLSearchParams();
    params.set("year", year);
    if (cc !== "any") {
      params.set("costCenter", cc);
    }
    router.push(`/accounting/budget?${params.toString()}`);
  };

  const handleYearChange = (year: string) => {
    setSelectedYear(year);
    handleFilterChange(year, selectedCostCenter);
  };

  const handleCostCenterChange = (cc: string) => {
    setSelectedCostCenter(cc);
    handleFilterChange(selectedYear, cc);
  };

  // 予実比較用のフィルタリング
  const filteredBudgetVsActual =
    selectedMonth === "all"
      ? budgetVsActual
      : budgetVsActual; // 月別フィルタはサーバー側で行うため、ここではそのまま渡す

  // 予算合計
  const totalBudget = budgets.reduce((sum, b) => sum + b.budgetAmount, 0);

  return (
    <div className="space-y-6">
      {/* フィルター */}
      <div className="flex flex-wrap gap-4 items-end">
        <div>
          <Label className="text-xs text-muted-foreground">年度</Label>
          <Select value={selectedYear} onValueChange={handleYearChange}>
            <SelectTrigger className="w-[130px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {YEAR_OPTIONS.map((y) => (
                <SelectItem key={y} value={y.toString()}>
                  {y}年度
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">
            コストセンター
          </Label>
          <Select
            value={selectedCostCenter}
            onValueChange={handleCostCenterChange}
          >
            <SelectTrigger className="w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="any">すべて</SelectItem>
              <SelectItem value="all">全社</SelectItem>
              {formData.costCenters.map((cc) => (
                <SelectItem key={cc.id} value={cc.id.toString()}>
                  {cc.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* サマリーカード */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">予算合計</div>
            <div className="text-2xl font-bold">
              ¥{totalBudget.toLocaleString()}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">カテゴリ数</div>
            <div className="text-2xl font-bold">
              {new Set(budgets.map((b) => b.categoryLabel)).size}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">予算レコード数</div>
            <div className="text-2xl font-bold">{budgets.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* タブ */}
      <Tabs defaultValue="input">
        <TabsList>
          <TabsTrigger value="input">予算入力</TabsTrigger>
          <TabsTrigger value="comparison">予実比較</TabsTrigger>
        </TabsList>

        <TabsContent value="input">
          <Card>
            <CardHeader>
              <CardTitle>
                予算入力（{selectedYear}年度）
              </CardTitle>
            </CardHeader>
            <CardContent>
              <BudgetInputTable
                budgets={budgets}
                formData={formData}
                fiscalYear={Number(selectedYear)}
                costCenterId={
                  selectedCostCenter === "any"
                    ? undefined
                    : selectedCostCenter === "all"
                      ? null
                      : Number(selectedCostCenter)
                }
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="comparison">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-4">
                <span>予実比較（{selectedYear}年度）</span>
                <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                  <SelectTrigger className="w-[130px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">年度全体</SelectItem>
                    {MONTHS.map((m, idx) => (
                      <SelectItem key={idx} value={idx.toString()}>
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <BudgetVsActualTable
                rows={filteredBudgetVsActual}
                fiscalYear={Number(selectedYear)}
                month={
                  selectedMonth === "all" ? undefined : Number(selectedMonth)
                }
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
