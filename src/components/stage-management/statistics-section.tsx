"use client";

import { StageStatistics } from "@/lib/stage-transition/types";

interface StatisticsSectionProps {
  statistics: StageStatistics;
}

export function StatisticsSection({ statistics }: StatisticsSectionProps) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <h3 className="font-semibold text-sm text-muted-foreground mb-3">
        統計情報
      </h3>
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">目標達成回数</span>
          <span className="font-medium">{statistics.achievedCount}回</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">目標達成率</span>
          <span className="font-medium">
            {statistics.achievementRate}%
            {statistics.achievedCount + statistics.cancelCount > 0 && (
              <span className="text-muted-foreground ml-1">
                （{statistics.achievedCount}/
                {statistics.achievedCount + statistics.cancelCount}）
              </span>
            )}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">後退回数</span>
          <span className="font-medium">{statistics.backCount}回</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">現在パイプライン滞在</span>
          <span className="font-medium">{statistics.currentStageDays}日</span>
        </div>
      </div>
    </div>
  );
}
