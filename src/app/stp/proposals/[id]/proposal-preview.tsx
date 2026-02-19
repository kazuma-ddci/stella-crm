"use client";

import type { ProposalContent } from "@/lib/proposals/simulation";

type Props = {
  content: ProposalContent;
};

function formatCurrency(value: number): string {
  return value.toLocaleString("ja-JP") + "円";
}

function formatCurrencyMan(value: number): string {
  return Math.round(value / 10000).toLocaleString("ja-JP") + "万円";
}

function formatPercent(value: number): string {
  return value + "%";
}

export function ProposalPreview({ content }: Props) {
  const { input, result } = content;
  const { before, scenario10, scenario20 } = result;

  return (
    <div className="bg-white border rounded-lg overflow-hidden text-sm">
      {/* 表紙 */}
      <div className="bg-gradient-to-br from-blue-600 to-blue-800 text-white p-8 text-center">
        <p className="text-xs uppercase tracking-widest mb-4 opacity-80">採用ブースト</p>
        <h1 className="text-2xl font-bold mb-2">採用コスト削減</h1>
        <h2 className="text-xl font-bold mb-6">シミュレーション提案書</h2>
        <div className="border-t border-white/30 pt-4 mt-4">
          <p className="text-lg font-semibold">{input.companyName} 様</p>
        </div>
        <p className="text-xs mt-4 opacity-70">
          {new Date(content.generatedAt).toLocaleDateString("ja-JP")}
        </p>
      </div>

      {/* Before - 現状分析 */}
      <div className="p-6 border-b">
        <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
          <span className="w-8 h-8 bg-red-100 text-red-600 rounded-full flex items-center justify-center text-xs font-bold">B</span>
          現状の採用コスト分析
        </h3>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="bg-gray-50 rounded-lg p-4 text-center">
            <p className="text-xs text-gray-500 mb-1">年間採用コスト</p>
            <p className="text-xl font-bold text-gray-800">{formatCurrencyMan(before.annualCost)}</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-4 text-center">
            <p className="text-xs text-gray-500 mb-1">年間採用人数</p>
            <p className="text-xl font-bold text-gray-800">{before.annualHires}名</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-4 text-center">
            <p className="text-xs text-gray-500 mb-1">1名あたり採用単価</p>
            <p className="text-xl font-bold text-red-600">{formatCurrency(before.costPerHire)}</p>
          </div>
          <div className="bg-red-50 rounded-lg p-4 text-center">
            <p className="text-xs text-gray-500 mb-1">目標{input.targetHires}名採用時の総コスト</p>
            <p className="text-xl font-bold text-red-600">{formatCurrencyMan(before.totalCostForTarget)}</p>
          </div>
        </div>

        <div className="text-xs text-gray-400">
          内訳: 人材紹介 {formatCurrencyMan(input.recruitmentAgencyCost)} / 求人広告 {formatCurrencyMan(input.jobAdCost)} / リファラル {formatCurrencyMan(input.referralCost)} / その他 {formatCurrencyMan(input.otherCost)}
        </div>
      </div>

      {/* After - 成果報酬型 */}
      <div className="p-6 border-b">
        <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
          <span className="w-8 h-8 bg-green-100 text-green-600 rounded-full flex items-center justify-center text-xs font-bold">A</span>
          採用ブースト導入後（成果報酬型）
        </h3>

        <div className="grid grid-cols-2 gap-4">
          {/* 10%シナリオ */}
          <div className="border rounded-lg p-4">
            <p className="text-xs text-gray-500 mb-2 font-medium">応募→採用率 10%</p>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-xs text-gray-500">予想期間</span>
                <span className="font-semibold">{scenario10.months}ヶ月</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-gray-500">総コスト</span>
                <span className="font-bold text-green-600">{formatCurrencyMan(scenario10.successFeeCost)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-gray-500">削減率</span>
                <span className={`font-bold ${scenario10.reductionSuccess > 0 ? "text-green-600" : "text-red-600"}`}>
                  {scenario10.reductionSuccess > 0 ? "▼" : "▲"}{formatPercent(Math.abs(scenario10.reductionSuccess))}
                </span>
              </div>
            </div>
          </div>

          {/* 20%シナリオ */}
          <div className="border rounded-lg p-4 border-green-200 bg-green-50/50">
            <p className="text-xs text-gray-500 mb-2 font-medium">応募→採用率 20%</p>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-xs text-gray-500">予想期間</span>
                <span className="font-semibold">{scenario20.months}ヶ月</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-gray-500">総コスト</span>
                <span className="font-bold text-green-600">{formatCurrencyMan(scenario20.successFeeCost)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-gray-500">削減率</span>
                <span className={`font-bold ${scenario20.reductionSuccess > 0 ? "text-green-600" : "text-red-600"}`}>
                  {scenario20.reductionSuccess > 0 ? "▼" : "▲"}{formatPercent(Math.abs(scenario20.reductionSuccess))}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* After - 月額固定型 */}
      <div className="p-6">
        <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
          <span className="w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-bold">A</span>
          採用ブースト導入後（月額固定型）
        </h3>

        <div className="grid grid-cols-2 gap-4">
          {/* 10%シナリオ */}
          <div className="border rounded-lg p-4">
            <p className="text-xs text-gray-500 mb-2 font-medium">応募→採用率 10%</p>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-xs text-gray-500">予想期間</span>
                <span className="font-semibold">{scenario10.months}ヶ月</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-gray-500">総コスト</span>
                <span className="font-bold text-blue-600">{formatCurrencyMan(scenario10.monthlyFeeCost)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-gray-500">削減率</span>
                <span className={`font-bold ${scenario10.reductionMonthly > 0 ? "text-blue-600" : "text-red-600"}`}>
                  {scenario10.reductionMonthly > 0 ? "▼" : "▲"}{formatPercent(Math.abs(scenario10.reductionMonthly))}
                </span>
              </div>
            </div>
          </div>

          {/* 20%シナリオ */}
          <div className="border rounded-lg p-4 border-blue-200 bg-blue-50/50">
            <p className="text-xs text-gray-500 mb-2 font-medium">応募→採用率 20%</p>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-xs text-gray-500">予想期間</span>
                <span className="font-semibold">{scenario20.months}ヶ月</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-gray-500">総コスト</span>
                <span className="font-bold text-blue-600">{formatCurrencyMan(scenario20.monthlyFeeCost)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-gray-500">削減率</span>
                <span className={`font-bold ${scenario20.reductionMonthly > 0 ? "text-blue-600" : "text-red-600"}`}>
                  {scenario20.reductionMonthly > 0 ? "▼" : "▲"}{formatPercent(Math.abs(scenario20.reductionMonthly))}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
