"use client";

import { ContractStatusInfo } from "@/lib/contract-status/types";
import { cn } from "@/lib/utils";
import { MapPin, CheckCircle2, Circle } from "lucide-react";
import { TERMINAL_STATUS_IDS, PROGRESS_STATUS_COUNT } from "@/lib/contract-status/constants";

interface StatusProgressVisualProps {
  statuses: ContractStatusInfo[];
  currentStatusId: number | null;
}

export function StatusProgressVisual({
  statuses,
  currentStatusId,
}: StatusProgressVisualProps) {
  // 進行中ステータス（displayOrder 1-6、isTerminal=false）をフィルタ
  const progressStatuses = statuses
    .filter((s) => !s.isTerminal && s.displayOrder <= PROGRESS_STATUS_COUNT)
    .sort((a, b) => a.displayOrder - b.displayOrder);

  // 終了ステータス（締結、破棄）
  const terminalStatuses = statuses.filter((s) => s.isTerminal);

  const currentStatus = statuses.find((s) => s.id === currentStatusId);
  const currentOrder = currentStatus?.displayOrder ?? 0;
  const currentIsTerminal = currentStatus?.isTerminal ?? false;

  const isPassed = (status: ContractStatusInfo) => {
    if (!currentStatus || currentIsTerminal) return false;
    return status.displayOrder < currentOrder;
  };

  const isCurrent = (status: ContractStatusInfo) => status.id === currentStatusId;

  // 現在が終了ステータスかどうか
  const isCurrentTerminal = currentIsTerminal;
  const isCurrentSigned = currentStatusId === TERMINAL_STATUS_IDS.SIGNED;
  const isCurrentDiscarded = currentStatusId === TERMINAL_STATUS_IDS.DISCARDED;

  return (
    <div className="rounded-lg border bg-card p-4">
      <h3 className="font-semibold text-sm text-muted-foreground mb-4">
        ステータス進捗
      </h3>

      {/* 進行ステータスのビジュアル */}
      <div className="relative mb-4">
        <div className="flex items-center justify-between">
          {progressStatuses.map((status, index) => {
            const passed = isPassed(status);
            const current = isCurrent(status);

            return (
              <div
                key={status.id}
                className="flex items-center flex-1 last:flex-none"
              >
                {/* ノードとラベル */}
                <div className="flex flex-col items-center relative">
                  {/* ノード */}
                  <div
                    className={cn(
                      "w-6 h-6 rounded-full flex items-center justify-center transition-all",
                      // 現在地
                      current && "bg-blue-500 border-2 border-blue-500",
                      // 通過済み
                      passed && !current && "bg-green-500 border-2 border-green-500",
                      // 未到達
                      !passed && !current && "bg-muted border-2 border-muted-foreground/30"
                    )}
                  >
                    {passed && !current ? (
                      <CheckCircle2 className="w-4 h-4 text-white" />
                    ) : current ? (
                      <MapPin className="w-3 h-3 text-white" />
                    ) : (
                      <Circle className="w-2.5 h-2.5 text-muted-foreground/30" />
                    )}
                  </div>

                  {/* ラベル */}
                  <span
                    className={cn(
                      "text-xs mt-1.5 whitespace-nowrap font-medium text-center max-w-[60px]",
                      current && "text-blue-600",
                      passed && !current && "text-green-600",
                      !current && !passed && "text-muted-foreground"
                    )}
                  >
                    {status.name}
                  </span>

                  {/* インジケーター */}
                  {current && (
                    <span className="text-[10px] mt-0.5 text-blue-600 font-medium">
                      現在
                    </span>
                  )}
                </div>

                {/* 接続ライン */}
                {index < progressStatuses.length - 1 && (
                  <div className="flex-1 flex items-center px-1 -mt-6">
                    <div
                      className={cn(
                        "h-0.5 flex-1 relative",
                        isPassed(progressStatuses[index + 1]) ||
                          isCurrent(progressStatuses[index + 1])
                          ? "bg-green-500"
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
                          isPassed(progressStatuses[index + 1]) ||
                            isCurrent(progressStatuses[index + 1])
                            ? "border-l-green-500"
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

      {/* 現在のサマリー */}
      <div className="flex items-center gap-2 text-sm bg-muted/50 rounded-md p-3 mb-3">
        <MapPin className="w-4 h-4 text-blue-500" />
        <span>
          現在のステータス：
          <span
            className={cn(
              "font-medium ml-1",
              isCurrentSigned && "text-green-600",
              isCurrentDiscarded && "text-red-600",
              !isCurrentTerminal && "text-blue-600"
            )}
          >
            {currentStatus?.name ?? "未設定"}
          </span>
        </span>
        {!isCurrentTerminal && currentOrder > 0 && (
          <span className="text-muted-foreground ml-2">
            （{currentOrder}/{PROGRESS_STATUS_COUNT}ステップ目）
          </span>
        )}
      </div>

      {/* 終了ステータスの説明 */}
      {terminalStatuses.length > 0 && (
        <div className="text-xs text-muted-foreground flex items-center gap-2">
          <span>※</span>
          <span>
            {terminalStatuses.map((s) => s.name).join("・")}
            は終了ステータスです
          </span>
          {isCurrentTerminal && currentStatus && (
            <span
              className={cn(
                "ml-2 font-medium",
                isCurrentSigned && "text-green-600",
                isCurrentDiscarded && "text-red-600"
              )}
            >
              （現在：{currentStatus.name}）
            </span>
          )}
        </div>
      )}
    </div>
  );
}
