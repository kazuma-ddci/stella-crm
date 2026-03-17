"use client";

import { StageInfo } from "@/lib/stage-transition/types";
import { cn } from "@/lib/utils";
import { Check, Star, Circle } from "lucide-react";

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

  const currentOrder = currentStage?.displayOrder ?? 0;

  const isPassed = (stage: StageInfo) => {
    if (!currentStage) return false;
    if (currentStage.stageType !== 'progress' && currentStage.stageType !== 'closed_won') {
      return false;
    }
    return (stage.displayOrder ?? 0) < currentOrder;
  };
  const isCurrent = (stage: StageInfo) => stage.id === currentStageId;
  const isTarget = (stage: StageInfo) => stage.id === targetStageId;

  // 現在が特殊ステージにいるか
  const isCurrentInSpecialStage =
    currentStage?.stageType === 'closed_lost' || currentStage?.stageType === 'pending';

  return (
    <div>
      {/* ステージノードとライン */}
      <div className="flex items-start">
        {progressStages.map((stage, index) => {
          const passed = isPassed(stage);
          const current = isCurrent(stage);
          const target = isTarget(stage);
          const isLast = index === progressStages.length - 1;

          return (
            <div key={stage.id} className={cn("flex items-start", !isLast && "flex-1")}>
              {/* ノードとラベル */}
              <div className="flex flex-col items-center min-w-0">
                {/* ノード */}
                <div
                  className={cn(
                    "w-6 h-6 rounded-full flex items-center justify-center shrink-0",
                    current && "bg-primary ring-2 ring-primary/20",
                    target && !current && "bg-orange-100 ring-2 ring-orange-300/40 border border-orange-400",
                    passed && !current && !target && "bg-primary/80",
                    !passed && !current && !target && "bg-muted border border-muted-foreground/20"
                  )}
                >
                  {current ? (
                    <div className="w-1.5 h-1.5 rounded-full bg-white" />
                  ) : target ? (
                    <Star className="w-2.5 h-2.5 text-orange-500 fill-orange-500" />
                  ) : passed ? (
                    <Check className="w-3 h-3 text-primary-foreground" />
                  ) : (
                    <Circle className="w-1.5 h-1.5 text-muted-foreground/30" />
                  )}
                </div>

                {/* ラベル */}
                <span
                  className={cn(
                    "text-[10px] mt-1 font-medium text-center leading-tight max-w-[64px] truncate",
                    current && "text-primary font-semibold",
                    target && !current && "text-orange-600 font-semibold",
                    passed && !current && !target && "text-muted-foreground",
                    !passed && !current && !target && "text-muted-foreground/50"
                  )}
                  title={stage.name}
                >
                  {stage.name}
                </span>

                {/* 現在地/目標ラベル */}
                {current && (
                  <span className="text-[8px] text-primary font-semibold mt-0.5 bg-primary/10 px-1 py-px rounded-full leading-none">
                    現在地
                  </span>
                )}
                {target && !current && (
                  <span className="text-[8px] text-orange-600 font-semibold mt-0.5 bg-orange-100 px-1 py-px rounded-full leading-none">
                    目標
                  </span>
                )}
              </div>

              {/* 接続ライン */}
              {!isLast && (
                <div className="flex-1 flex items-center px-0.5 mt-3">
                  <div
                    className={cn(
                      "h-[2px] flex-1 rounded-full",
                      isPassed(progressStages[index + 1]) || isCurrent(progressStages[index + 1])
                        ? "bg-primary/60"
                        : "bg-muted-foreground/15"
                    )}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 特殊ステージの表示 */}
      {(specialStages.length > 0 && isCurrentInSpecialStage && currentStage) && (
        <div className="mt-2 flex justify-center">
          <span className="inline-flex items-center gap-1.5 text-[10px] bg-orange-50 text-orange-700 px-2 py-0.5 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-orange-400" />
            現在: {currentStage.name}
          </span>
        </div>
      )}
    </div>
  );
}
