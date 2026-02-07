"use client";

import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";

type TypeItem = {
  key: string;
  label: string;
};

type MonthlyAmount = {
  month: string; // "2026/01" 形式
  amounts: Record<string, number>; // key: typeのkey, value: 税込金額
};

type Section = {
  title: string;
  types: TypeItem[];
  monthlyData: MonthlyAmount[];
};

type Props = {
  sections: Section[];
  months: string[];
  showGrossProfit?: boolean;
  entityName: string;
};

export function FinanceSummaryTable({
  sections,
  months,
  showGrossProfit = false,
  entityName,
}: Props) {
  // 各セクションの各typeのチェック状態を管理
  const [checkedState, setCheckedState] = useState<Record<string, Record<string, boolean>>>(() => {
    const state: Record<string, Record<string, boolean>> = {};
    sections.forEach((section, sIdx) => {
      const sectionKey = `s${sIdx}`;
      state[sectionKey] = {};
      section.types.forEach((type) => {
        state[sectionKey][type.key] = true;
      });
    });
    return state;
  });

  const toggleType = (sectionKey: string, typeKey: string) => {
    setCheckedState((prev) => ({
      ...prev,
      [sectionKey]: {
        ...prev[sectionKey],
        [typeKey]: !prev[sectionKey][typeKey],
      },
    }));
  };

  const toggleAllInSection = (sectionKey: string, types: TypeItem[], checked: boolean) => {
    setCheckedState((prev) => ({
      ...prev,
      [sectionKey]: Object.fromEntries(types.map((t) => [t.key, checked])),
    }));
  };

  // 各セクションの月別合計と累計を計算
  const sectionCalculations = useMemo(() => {
    return sections.map((section, sIdx) => {
      const sectionKey = `s${sIdx}`;
      const checks = checkedState[sectionKey] || {};

      const monthlyTotals = months.map((month) => {
        const monthData = section.monthlyData.find((d) => d.month === month);
        if (!monthData) return 0;

        return Object.entries(monthData.amounts).reduce((sum, [key, amount]) => {
          if (checks[key]) {
            return sum + amount;
          }
          return sum;
        }, 0);
      });

      // 累計
      const cumulativeTotals: number[] = [];
      let cumulative = 0;
      monthlyTotals.forEach((total) => {
        cumulative += total;
        cumulativeTotals.push(cumulative);
      });

      return { monthlyTotals, cumulativeTotals };
    });
  }, [sections, months, checkedState]);

  // 粗利計算（売上セクション[0] - 経費セクション[1]）
  const grossProfitData = useMemo(() => {
    if (!showGrossProfit || sections.length < 2) return null;

    const revCalc = sectionCalculations[0];
    const expCalc = sectionCalculations[1];

    const monthlyProfits = months.map((_, i) => {
      return (revCalc?.monthlyTotals[i] || 0) - (expCalc?.monthlyTotals[i] || 0);
    });

    const cumulativeProfits: number[] = [];
    let cumulative = 0;
    monthlyProfits.forEach((profit) => {
      cumulative += profit;
      cumulativeProfits.push(cumulative);
    });

    return { monthlyProfits, cumulativeProfits };
  }, [showGrossProfit, sections, sectionCalculations, months]);

  return (
    <div className="space-y-6">
      {/* エンティティ名ヘッダー */}
      <h2 className="text-xl font-bold">{entityName} - 収支サマリー</h2>

      {/* サマリーカード */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {sections.map((section, sIdx) => {
          const calc = sectionCalculations[sIdx];
          const total = calc.cumulativeTotals[calc.cumulativeTotals.length - 1] || 0;
          return (
            <Card key={sIdx}>
              <CardContent className="pt-6">
                <div className="text-sm text-muted-foreground">{section.title}合計</div>
                <div className="text-2xl font-bold">
                  ¥{total.toLocaleString()}
                </div>
              </CardContent>
            </Card>
          );
        })}
        {showGrossProfit && grossProfitData && (
          <Card>
            <CardContent className="pt-6">
              <div className="text-sm text-muted-foreground">粗利合計</div>
              <div
                className={`text-2xl font-bold ${
                  (grossProfitData.cumulativeProfits[grossProfitData.cumulativeProfits.length - 1] || 0) >= 0
                    ? "text-green-600"
                    : "text-red-600"
                }`}
              >
                ¥{(grossProfitData.cumulativeProfits[grossProfitData.cumulativeProfits.length - 1] || 0).toLocaleString()}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* 各セクションのテーブル */}
      {sections.map((section, sIdx) => {
        const sectionKey = `s${sIdx}`;
        const checks = checkedState[sectionKey] || {};
        const calc = sectionCalculations[sIdx];
        const allChecked = section.types.every((t) => checks[t.key]);
        const someChecked = section.types.some((t) => checks[t.key]);

        return (
          <Card key={sIdx}>
            <CardHeader>
              <CardTitle>{section.title}</CardTitle>
              {/* チェックボックスフィルター */}
              <div className="flex flex-wrap items-center gap-4 pt-2">
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={allChecked}
                    onCheckedChange={(checked) => {
                      toggleAllInSection(sectionKey, section.types, !!checked);
                    }}
                    className={!allChecked && someChecked ? "data-[state=unchecked]:bg-muted" : ""}
                  />
                  <span className="font-medium">全選択</span>
                </label>
                {section.types.map((type) => (
                  <label key={type.key} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={checks[type.key] || false}
                      onCheckedChange={() => toggleType(sectionKey, type.key)}
                    />
                    <span>{type.label}</span>
                  </label>
                ))}
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="py-2 text-left font-medium min-w-[100px]">年月</th>
                      {section.types.map((type) =>
                        checks[type.key] ? (
                          <th key={type.key} className="py-2 text-right font-medium min-w-[120px]">
                            {type.label}
                          </th>
                        ) : null
                      )}
                      <th className="py-2 text-right font-medium min-w-[120px] bg-muted/30">合計</th>
                      <th className="py-2 text-right font-medium min-w-[120px] bg-muted/30">累計</th>
                    </tr>
                  </thead>
                  <tbody>
                    {months.map((month, mIdx) => {
                      const monthData = section.monthlyData.find((d) => d.month === month);
                      return (
                        <tr key={month} className="border-b hover:bg-muted/20">
                          <td className="py-2 font-medium">{month}</td>
                          {section.types.map((type) =>
                            checks[type.key] ? (
                              <td key={type.key} className="py-2 text-right">
                                ¥{(monthData?.amounts[type.key] || 0).toLocaleString()}
                              </td>
                            ) : null
                          )}
                          <td className="py-2 text-right font-medium bg-muted/30">
                            ¥{(calc.monthlyTotals[mIdx] || 0).toLocaleString()}
                          </td>
                          <td className="py-2 text-right font-medium bg-muted/30">
                            ¥{(calc.cumulativeTotals[mIdx] || 0).toLocaleString()}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        );
      })}

      {/* 粗利セクション */}
      {showGrossProfit && grossProfitData && (
        <Card>
          <CardHeader>
            <CardTitle>粗利</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="py-2 text-left font-medium min-w-[100px]">年月</th>
                    <th className="py-2 text-right font-medium min-w-[120px]">粗利</th>
                    <th className="py-2 text-right font-medium min-w-[120px] bg-muted/30">累計</th>
                  </tr>
                </thead>
                <tbody>
                  {months.map((month, mIdx) => (
                    <tr key={month} className="border-b hover:bg-muted/20">
                      <td className="py-2 font-medium">{month}</td>
                      <td
                        className={`py-2 text-right font-medium ${
                          (grossProfitData.monthlyProfits[mIdx] || 0) >= 0
                            ? "text-green-600"
                            : "text-red-600"
                        }`}
                      >
                        ¥{(grossProfitData.monthlyProfits[mIdx] || 0).toLocaleString()}
                      </td>
                      <td
                        className={`py-2 text-right font-medium bg-muted/30 ${
                          (grossProfitData.cumulativeProfits[mIdx] || 0) >= 0
                            ? "text-green-600"
                            : "text-red-600"
                        }`}
                      >
                        ¥{(grossProfitData.cumulativeProfits[mIdx] || 0).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
