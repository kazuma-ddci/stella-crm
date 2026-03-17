"use client";

import { StageManagementData } from "@/lib/stage-transition/types";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  MapPin,
  Target,
  TrendingUp,
  TrendingDown,
  Trophy,
  Clock,
} from "lucide-react";

interface CurrentStatusSectionProps {
  data: StageManagementData;
}

export function CurrentStatusSection({ data }: CurrentStatusSectionProps) {
  const formatDate = (date: Date | null) => {
    if (!date) return "-";
    return new Date(date).toLocaleDateString("ja-JP", {
      timeZone: "Asia/Tokyo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  };

  const getRemainingDays = (date: Date | null) => {
    if (!date) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const targetDate = new Date(date);
    targetDate.setHours(0, 0, 0, 0);
    const diff = Math.ceil(
      (targetDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
    );
    return diff;
  };

  const remainingDays = getRemainingDays(data.nextTargetDate);

  const getRemainingDaysText = () => {
    if (remainingDays === null) return "";
    if (remainingDays < 0) return `${Math.abs(remainingDays)}日超過`;
    if (remainingDays === 0) return "本日期限";
    return `あと${remainingDays}日`;
  };

  const getTargetDateStyle = () => {
    if (remainingDays === null) return { isOverdue: false, isUrgent: false, isSoon: false };
    return {
      isOverdue: remainingDays < 0,
      isUrgent: remainingDays >= 0 && remainingDays <= 3,
      isSoon: remainingDays > 3 && remainingDays <= 7,
    };
  };

  const targetDateStyle = getTargetDateStyle();

  return (
    <div className="space-y-3">
      {/* 現在地 → 目標 のメインステータス */}
      <div className="rounded-lg border bg-card p-4">
        <div className="flex flex-col sm:flex-row items-stretch gap-3">
          {/* 現在地 */}
          <div className="flex-1 rounded-md bg-primary/5 border border-primary/15 p-3 @container">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-primary" />
                <span className="text-xs font-medium text-primary">現在地</span>
              </div>
              <span className="text-sm font-semibold mr-1">
                {data.currentStage?.name ?? "未設定"}
              </span>
            </div>
            {/* 滞在日数を目立たせる */}
            <div className="flex items-center gap-1.5 bg-white/60 rounded px-2 py-1.5">
              <Clock className="w-3.5 h-3.5 text-primary/70 shrink-0" />
              <span className="text-sm @[180px]:text-base font-bold tabular-nums text-primary whitespace-nowrap">
                {data.statistics.currentStageDays}
                <span className="text-[10px] @[180px]:text-xs font-medium ml-0.5">日滞在</span>
              </span>
              {data.statistics.stageStartDate && (
                <span className="text-[10px] text-muted-foreground ml-auto whitespace-nowrap">
                  {formatDate(data.statistics.stageStartDate)}〜
                </span>
              )}
            </div>
          </div>

          {/* 矢印 */}
          <div className="flex items-center justify-center text-muted-foreground/40">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="hidden sm:block">
              <path d="M4 10H16M16 10L11 5M16 10L11 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="sm:hidden">
              <path d="M10 4V16M10 16L5 11M10 16L15 11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>

          {/* 目標 */}
          <div className={cn(
            "flex-1 rounded-md p-3 border @container",
            targetDateStyle.isOverdue
              ? "bg-red-50/80 border-red-300/60"
              : data.nextTargetStage
                ? "bg-orange-50/60 border-orange-200/60"
                : "bg-muted/30 border-transparent"
          )}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <Target className={cn(
                  "w-3.5 h-3.5",
                  targetDateStyle.isOverdue ? "text-red-500" : "text-orange-500"
                )} />
                <span className={cn(
                  "text-xs font-medium",
                  targetDateStyle.isOverdue ? "text-red-600" : "text-orange-600"
                )}>目標</span>
              </div>
              <span className={cn(
                "text-sm font-semibold mr-1",
                !data.nextTargetStage && "text-muted-foreground"
              )}>
                {data.nextTargetStage?.name ?? "未設定"}
              </span>
            </div>
            {/* 目標日を目立たせる */}
            {data.nextTargetDate ? (
              <div className={cn(
                "flex items-center gap-1.5 rounded px-2 py-1.5",
                targetDateStyle.isOverdue && "bg-red-100/80",
                targetDateStyle.isUrgent && "bg-orange-100/60",
                targetDateStyle.isSoon && "bg-yellow-50/60",
                !targetDateStyle.isOverdue && !targetDateStyle.isUrgent && !targetDateStyle.isSoon && "bg-white/60",
              )}>
                {targetDateStyle.isOverdue && (
                  <AlertTriangle className="w-3.5 h-3.5 @[180px]:w-4 @[180px]:h-4 text-red-500 shrink-0" />
                )}
                <span className={cn(
                  "text-sm @[180px]:text-base font-bold tabular-nums whitespace-nowrap",
                  targetDateStyle.isOverdue && "text-red-600",
                  targetDateStyle.isUrgent && "text-orange-600",
                  targetDateStyle.isSoon && "text-yellow-700",
                  !targetDateStyle.isOverdue && !targetDateStyle.isUrgent && !targetDateStyle.isSoon && "text-foreground",
                )}>
                  {getRemainingDaysText()}
                </span>
                <span className={cn(
                  "text-[9px] @[180px]:text-[10px] ml-auto whitespace-nowrap",
                  targetDateStyle.isOverdue ? "text-red-500" : "text-muted-foreground"
                )}>
                  {formatDate(data.nextTargetDate)}
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 bg-white/60 rounded px-2 py-1.5">
                <span className="text-xs text-muted-foreground">期限未設定</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 統計カード群 */}
      <div className="grid grid-cols-3 gap-2 min-w-0">
        <div className="rounded-lg border bg-card px-3 py-2.5 text-center">
          <div className="flex items-center justify-center gap-1 mb-0.5">
            <Trophy className="w-3.5 h-3.5 text-green-500" />
            <span className="text-xs text-muted-foreground">達成率</span>
          </div>
          <p className="text-lg font-bold tabular-nums">
            {data.statistics.achievementRate}
            <span className="text-xs font-normal text-muted-foreground ml-0.5">%</span>
          </p>
          {(data.statistics.achievedCount + data.statistics.cancelCount > 0) && (
            <p className="text-[10px] text-muted-foreground">
              {data.statistics.achievedCount}/{data.statistics.achievedCount + data.statistics.cancelCount}
            </p>
          )}
        </div>

        <div className="rounded-lg border bg-card px-3 py-2.5 text-center">
          <div className="flex items-center justify-center gap-1 mb-0.5">
            <TrendingUp className="w-3.5 h-3.5 text-blue-500" />
            <span className="text-xs text-muted-foreground">達成</span>
          </div>
          <p className="text-lg font-bold tabular-nums">
            {data.statistics.achievedCount}
            <span className="text-xs font-normal text-muted-foreground ml-0.5">回</span>
          </p>
        </div>

        <div className="rounded-lg border bg-card px-3 py-2.5 text-center">
          <div className="flex items-center justify-center gap-1 mb-0.5">
            <TrendingDown className="w-3.5 h-3.5 text-amber-500" />
            <span className="text-xs text-muted-foreground">後退</span>
          </div>
          <p className="text-lg font-bold tabular-nums">
            {data.statistics.backCount}
            <span className="text-xs font-normal text-muted-foreground ml-0.5">回</span>
          </p>
        </div>
      </div>
    </div>
  );
}
