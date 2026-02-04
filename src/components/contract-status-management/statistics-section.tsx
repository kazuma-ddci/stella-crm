"use client";

import { ContractStatusStatistics } from "@/lib/contract-status/types";

interface StatisticsSectionProps {
  statistics: ContractStatusStatistics;
}

export function StatisticsSection({ statistics }: StatisticsSectionProps) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <h3 className="font-semibold text-sm text-muted-foreground mb-3">
        統計情報
      </h3>
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">総変更回数</span>
          <span className="font-medium">{statistics.totalChanges}回</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">平均滞在日数</span>
          <span className="font-medium">{statistics.averageDaysPerStatus}日</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">現在ステータス滞在</span>
          <span className="font-medium">{statistics.currentStatusDays}日</span>
        </div>
      </div>
    </div>
  );
}
