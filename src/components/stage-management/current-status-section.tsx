"use client";

import { StageManagementData } from "@/lib/stage-transition/types";
import { cn } from "@/lib/utils";
import { AlertTriangle } from "lucide-react";

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
    if (remainingDays < 0) return `（${Math.abs(remainingDays)}日超過）`;
    if (remainingDays === 0) return "（本日）";
    return `（あと${remainingDays}日）`;
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
    <div className="rounded-lg border bg-card p-4">
      <h3 className="font-semibold text-sm text-muted-foreground mb-3">
        現在の状況
      </h3>
      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">現在のステージ</span>
          <span className="font-medium">
            {data.currentStage?.name ?? "未設定"}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">このステージの滞在</span>
          <span>
            {data.statistics.currentStageDays}日間
            {data.statistics.stageStartDate && (
              <span className="text-muted-foreground ml-1">
                （{formatDate(data.statistics.stageStartDate)}〜）
              </span>
            )}
          </span>
        </div>
        <div className="h-px bg-border my-2" />
        <div className="flex justify-between">
          <span className="text-muted-foreground">目標ステージ</span>
          <span className="font-medium">
            {data.nextTargetStage?.name ?? "未設定"}
          </span>
        </div>

        {/* 目標日 - 視覚的警告付き */}
        <div
          className={cn(
            "flex justify-between items-center rounded-md px-2 py-1 -mx-2",
            targetDateStyle.isOverdue && "bg-red-50"
          )}
        >
          <span className="text-muted-foreground">目標日</span>
          <span
            className={cn(
              "flex items-center gap-1",
              targetDateStyle.isOverdue && "text-red-600 font-medium",
              targetDateStyle.isUrgent && "text-orange-600 font-medium",
              targetDateStyle.isSoon && "text-yellow-600"
            )}
          >
            {targetDateStyle.isOverdue && (
              <AlertTriangle className="w-4 h-4" />
            )}
            {formatDate(data.nextTargetDate)}
            <span className="ml-1">{getRemainingDaysText()}</span>
          </span>
        </div>

        {data.targetSetDate && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">目標設定日</span>
            <span>{formatDate(data.targetSetDate)}</span>
          </div>
        )}
      </div>
    </div>
  );
}
