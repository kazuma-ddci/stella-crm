"use client";

import { useState } from "react";
import { ContractStatusHistoryRecord } from "@/lib/contract-status/types";
import { CONTRACT_STATUS_EVENT_LABELS } from "@/lib/contract-status/constants";
import { Button } from "@/components/ui/button";

interface StatusHistorySectionProps {
  histories: ContractStatusHistoryRecord[];
}

export function StatusHistorySection({ histories }: StatusHistorySectionProps) {
  const [displayCount, setDisplayCount] = useState(5);

  const formatDateTime = (date: Date) => {
    return new Date(date).toLocaleString("ja-JP", {
      timeZone: "Asia/Tokyo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getEventLabel = (eventType: string) => {
    return (
      CONTRACT_STATUS_EVENT_LABELS[
        eventType as keyof typeof CONTRACT_STATUS_EVENT_LABELS
      ] ?? { label: eventType, icon: "" }
    );
  };

  const getEventDescription = (history: ContractStatusHistoryRecord) => {
    const { eventType, fromStatus, toStatus } = history;

    switch (eventType) {
      case "created":
        return `${toStatus?.name ?? "不明"}で作成`;
      case "progress":
        return `${fromStatus?.name ?? "不明"} → ${toStatus?.name ?? "不明"}`;
      case "back":
        return `${fromStatus?.name ?? "不明"} → ${toStatus?.name ?? "不明"}`;
      case "signed":
        return "締結";
      case "discarded":
        return "破棄";
      case "revived":
        return `破棄から復活 → ${toStatus?.name ?? "不明"}`;
      case "reopened":
        return `締結済みから再開 → ${toStatus?.name ?? "不明"}`;
      default:
        return "";
    }
  };

  const totalCount = histories.length;
  const displayHistories = histories.slice(0, displayCount);
  const remainingCount = totalCount - displayCount;
  const hasMore = displayCount < totalCount;

  const handleShowMore = () => {
    setDisplayCount((prev) => Math.min(prev + 5, totalCount));
  };

  if (histories.length === 0) {
    return (
      <div className="rounded-lg border bg-card p-4">
        <h3 className="font-semibold text-sm text-muted-foreground mb-3">
          ステータス履歴
        </h3>
        <p className="text-sm text-muted-foreground">履歴がありません</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-card p-4">
      <h3 className="font-semibold text-sm text-muted-foreground mb-3">
        ステータス履歴
        <span className="font-normal ml-1">
          （全{totalCount}件中、最新{Math.min(displayCount, totalCount)}
          件を表示）
        </span>
      </h3>
      <div className="space-y-3">
        {displayHistories.map((history) => {
          const { label, icon } = getEventLabel(history.eventType);
          return (
            <div
              key={history.id}
              className="rounded-lg border bg-muted/30 p-3"
            >
              {/* ヘッダー：日時と担当者 */}
              <div className="flex items-center justify-between mb-2 text-sm">
                <span className="text-muted-foreground">
                  {formatDateTime(history.recordedAt)}
                </span>
                {history.changedBy && (
                  <span className="text-muted-foreground">
                    担当：{history.changedBy}
                  </span>
                )}
              </div>

              {/* イベント内容 */}
              <div className="bg-background rounded-md p-2">
                <div className="flex items-center gap-2 text-sm">
                  <span>{icon}</span>
                  <span className="text-muted-foreground min-w-[60px]">
                    {label}：
                  </span>
                  <span>{getEventDescription(history)}</span>
                </div>
              </div>

              {/* メモ */}
              {history.note && (
                <div className="mt-2 text-sm">
                  <span className="text-muted-foreground">メモ：</span>
                  <span>{history.note}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* もっと見るボタン */}
      {hasMore && (
        <Button
          variant="ghost"
          size="sm"
          onClick={handleShowMore}
          className="mt-3 w-full"
        >
          もっと見る（残り{remainingCount}件）
        </Button>
      )}
    </div>
  );
}
