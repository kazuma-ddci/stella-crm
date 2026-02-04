"use client";

import { ContractStatusManagementData } from "@/lib/contract-status/types";
import { cn } from "@/lib/utils";
import { AlertTriangle } from "lucide-react";
import { STALE_ALERT_DAYS, SENT_STATUS_ID } from "@/lib/contract-status/constants";

interface CurrentStatusSectionProps {
  data: ContractStatusManagementData;
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

  const { statistics, currentStatus, currentStatusId } = data;

  // 滞留アラートのチェック
  const isStale =
    currentStatusId === SENT_STATUS_ID &&
    statistics.currentStatusDays >= STALE_ALERT_DAYS;

  return (
    <div className="rounded-lg border bg-card p-4">
      <h3 className="font-semibold text-sm text-muted-foreground mb-3">
        現在の状況
      </h3>
      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">契約書名</span>
          <span className="font-medium">{data.contractTitle}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">企業名</span>
          <span>{data.companyName}</span>
        </div>
        {data.assignedTo && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">担当者</span>
            <span>{data.assignedTo}</span>
          </div>
        )}
        <div className="h-px bg-border my-2" />
        <div className="flex justify-between">
          <span className="text-muted-foreground">現在のステータス</span>
          <span
            className={cn(
              "font-medium",
              currentStatus?.isTerminal && "text-green-600"
            )}
          >
            {currentStatus?.name ?? "未設定"}
          </span>
        </div>

        {/* 滞在日数 - 滞留アラート付き */}
        <div
          className={cn(
            "flex justify-between items-center rounded-md px-2 py-1 -mx-2",
            isStale && "bg-yellow-50"
          )}
        >
          <span className="text-muted-foreground">このステータスの滞在</span>
          <span
            className={cn(
              "flex items-center gap-1",
              isStale && "text-yellow-600 font-medium"
            )}
          >
            {isStale && <AlertTriangle className="w-4 h-4" />}
            {statistics.currentStatusDays}日間
            {statistics.statusStartDate && (
              <span className="text-muted-foreground ml-1">
                （{formatDate(statistics.statusStartDate)}〜）
              </span>
            )}
          </span>
        </div>

        {/* 滞留アラートメッセージ */}
        {isStale && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-md p-2 text-yellow-800 text-xs">
            ⚠️ 送付済みのまま{statistics.currentStatusDays}
            日経過しています。先方に確認してください。
          </div>
        )}
      </div>
    </div>
  );
}
