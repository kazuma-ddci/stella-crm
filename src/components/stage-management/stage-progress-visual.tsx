"use client";

import { StageInfo } from "@/lib/stage-transition/types";
import { cn } from "@/lib/utils";
import { MapPin, Target, Star, Circle } from "lucide-react";

interface StageProgressVisualProps {
  stages: StageInfo[];
  currentStageId: number | null;
  targetStageId: number | null;
}

export function StageProgressVisual({
  stages,
  currentStageId,
  targetStageId,
}: StageProgressVisualProps) {
  // stageTypeで分類
  const progressStages = stages
    .filter((s) => s.stageType === 'progress' || s.stageType === 'closed_won')
    .sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));

  const specialStages = stages.filter(
    (s) => s.stageType === 'closed_lost' || s.stageType === 'pending'
  );

  const currentStage = stages.find((s) => s.id === currentStageId);
  const targetStage = stages.find((s) => s.id === targetStageId);

  const currentOrder = currentStage?.displayOrder ?? 0;
  const targetOrder = targetStage?.displayOrder ?? 0;

  const isPassed = (stage: StageInfo) => {
    if (!currentStage) return false;
    // 現在が特殊ステージの場合は判定しない
    if (currentStage.stageType !== 'progress' && currentStage.stageType !== 'closed_won') {
      return false;
    }
    return (stage.displayOrder ?? 0) < currentOrder;
  };
  const isCurrent = (stage: StageInfo) => stage.id === currentStageId;
  const isTarget = (stage: StageInfo) => stage.id === targetStageId;

  // ステップ数を計算（目標が進行ステージ内の場合のみ）
  const stepsRemaining =
    targetStageId &&
    targetOrder > currentOrder &&
    targetStage?.stageType === 'progress' &&
    currentStage?.stageType === 'progress'
      ? targetOrder - currentOrder
      : null;

  // 現在が特殊ステージにいるか
  const isCurrentInSpecialStage =
    currentStage?.stageType === 'closed_lost' || currentStage?.stageType === 'pending';

  return (
    <div className="rounded-lg border bg-card p-4">
      <h3 className="font-semibold text-sm text-muted-foreground mb-4">
        パイプライン進捗
      </h3>

      {/* 進行ステージのビジュアル */}
      <div className="relative mb-4 overflow-x-auto">
        {/* ステージノードとライン */}
        <div className="flex items-center">
          {progressStages.map((stage, index) => {
            const passed = isPassed(stage);
            const current = isCurrent(stage);
            const target = isTarget(stage);

            return (
              <div key={stage.id} className="flex items-center flex-1 last:flex-none min-w-[64px] last:min-w-0">
                {/* ノードとラベル */}
                <div className="flex flex-col items-center relative">
                  {/* ノード */}
                  <div
                    className={cn(
                      "w-6 h-6 rounded-full flex items-center justify-center transition-all",
                      // 目標地点
                      target && !current && "bg-orange-100 border-2 border-orange-500",
                      // 現在地
                      current && "bg-primary border-2 border-primary",
                      // 通過済み（目標でも現在でもない）
                      passed && !current && !target && "bg-primary border-2 border-primary",
                      // 未到達（目標でも現在でもない）
                      !passed && !current && !target && "bg-muted border-2 border-muted-foreground/30"
                    )}
                  >
                    {target && !current ? (
                      <Star className="w-3 h-3 text-orange-500 fill-orange-500" />
                    ) : (passed || current) ? (
                      <Circle className="w-2.5 h-2.5 text-primary-foreground fill-primary-foreground" />
                    ) : (
                      <Circle className="w-2.5 h-2.5 text-muted-foreground/30" />
                    )}
                  </div>

                  {/* ラベル */}
                  <span
                    className={cn(
                      "text-xs mt-1.5 font-medium max-w-[56px] overflow-hidden text-ellipsis whitespace-nowrap",
                      current && "text-primary",
                      target && !current && "text-orange-600",
                      !current && !target && "text-muted-foreground"
                    )}
                    title={stage.name}
                  >
                    {stage.name}
                  </span>

                  {/* インジケーター */}
                  {(current || target) && (
                    <span
                      className={cn(
                        "text-[10px] mt-0.5",
                        current && "text-primary font-medium",
                        target && !current && "text-orange-600"
                      )}
                    >
                      {current && "現在地"}
                      {target && !current && "目標"}
                    </span>
                  )}
                </div>

                {/* 接続矢印ライン */}
                {index < progressStages.length - 1 && (
                  <div className="flex-1 flex items-center px-1 -mt-6">
                    <div
                      className={cn(
                        "h-0.5 flex-1 relative",
                        isPassed(progressStages[index + 1]) || isCurrent(progressStages[index + 1])
                          ? "bg-primary"
                          : "bg-muted-foreground/30"
                      )}
                    >
                      {/* 矢印 */}
                      <div
                        className={cn(
                          "absolute right-0 top-1/2 -translate-y-1/2 w-0 h-0",
                          "border-t-[4px] border-t-transparent",
                          "border-b-[4px] border-b-transparent",
                          "border-l-[6px]",
                          isPassed(progressStages[index + 1]) || isCurrent(progressStages[index + 1])
                            ? "border-l-primary"
                            : "border-l-muted-foreground/30"
                        )}
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 現在と目標のサマリー */}
      <div className="flex items-center gap-2 text-sm bg-muted/50 rounded-md p-3 mb-3">
        <MapPin className="w-4 h-4 text-primary" />
        <span>
          現在：
          <span className="font-medium">
            {currentStage?.name ?? "未設定"}
          </span>
        </span>
        <span className="text-muted-foreground mx-2">→</span>
        <Target className="w-4 h-4 text-orange-500" />
        <span>
          目標：
          <span className={cn("font-medium", targetStage ? "text-orange-600" : "text-muted-foreground")}>
            {targetStage?.name ?? "未設定"}
          </span>
          {stepsRemaining !== null && (
            <span className="text-muted-foreground ml-1">
              （あと{stepsRemaining}ステップ）
            </span>
          )}
        </span>
      </div>

      {/* 特殊ステージの説明 */}
      {specialStages.length > 0 && (
        <div className="text-xs text-muted-foreground flex items-center gap-2">
          <span>※</span>
          <span>
            {specialStages.map((s) => s.name).join("・")}
            は特殊ステータスのため上記には含まれません
          </span>
          {isCurrentInSpecialStage && currentStage && (
            <span className="ml-2 text-orange-600 font-medium">
              （現在：{currentStage.name}）
            </span>
          )}
        </div>
      )}
    </div>
  );
}
