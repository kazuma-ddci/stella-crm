"use client";

import { useState, useMemo } from "react";
import { StageHistoryRecord } from "@/lib/stage-transition/types";
import { EVENT_LABELS, RECOMMIT_SUBTYPE_LABELS } from "@/lib/stage-transition/constants";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface StageHistorySectionProps {
  histories: StageHistoryRecord[];
}

interface HistoryGroup {
  recordedAt: Date;
  changedBy: string | null;
  note: string | null;
  lostReason: string | null;
  pendingReason: string | null;
  events: StageHistoryRecord[];
}

// イベントの優先順位（ステージ変更系を先に）
const EVENT_PRIORITY: Record<string, number> = {
  achieved: 1,
  won: 2,
  lost: 3,
  suspended: 4,
  resumed: 5,
  revived: 6,
  progress: 7,
  back: 8,
  commit: 9,
  recommit: 10,
  cancel: 11,
  reason_updated: 12,
};

// イベントタイプに対応する色
const EVENT_DOT_COLORS: Record<string, string> = {
  achieved: "bg-green-500",
  won: "bg-green-600",
  lost: "bg-gray-400",
  suspended: "bg-orange-400",
  resumed: "bg-blue-500",
  revived: "bg-purple-500",
  progress: "bg-blue-400",
  back: "bg-amber-500",
  commit: "bg-primary",
  recommit: "bg-primary",
  cancel: "bg-red-400",
  reason_updated: "bg-gray-400",
};

export function StageHistorySection({ histories }: StageHistorySectionProps) {
  const [displayCount, setDisplayCount] = useState(5);

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString("ja-JP", {
      timeZone: "Asia/Tokyo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  };

  const formatDateTime = (date: Date) => {
    return new Date(date).toLocaleString("ja-JP", {
      timeZone: "Asia/Tokyo",
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getEventLabel = (eventType: string, subType?: string | null) => {
    const event = EVENT_LABELS[eventType as keyof typeof EVENT_LABELS];
    if (!event) {
      return { label: eventType, icon: "" };
    }

    if (eventType === "recommit" && subType) {
      const subTypeLabel = RECOMMIT_SUBTYPE_LABELS[subType];
      if (subTypeLabel) {
        return { ...event, label: `${event.label}(${subTypeLabel})` };
      }
    }

    return event;
  };

  const getEventDescription = (history: StageHistoryRecord) => {
    const { eventType, fromStage, toStage, targetDate, } = history;

    switch (eventType) {
      case "commit":
        return (
          <>
            {toStage?.name ?? "不明"}を目標に設定
            {targetDate && (
              <span className="text-muted-foreground">
                {" "}({formatDate(targetDate)})
              </span>
            )}
          </>
        );
      case "achieved":
        return `${toStage?.name ?? "不明"}に到達`;
      case "recommit":
        return (
          <>
            目標を{toStage?.name ?? "不明"}に変更
            {targetDate && (
              <span className="text-muted-foreground">
                {" "}({formatDate(targetDate)})
              </span>
            )}
          </>
        );
      case "progress":
        if (fromStage) {
          return `${fromStage.name} → ${toStage?.name ?? "不明"}`;
        }
        return `${toStage?.name ?? "不明"}で開始`;
      case "back":
        return `${fromStage?.name ?? "不明"} → ${toStage?.name ?? "不明"}`;
      case "cancel":
        return `目標「${toStage?.name ?? "不明"}」を取消`;
      case "won":
        return `受注`;
      case "lost":
        return `失注`;
      case "suspended":
        return `検討中に移行`;
      case "resumed":
        return `検討中から${toStage?.name ?? "不明"}へ再開`;
      case "revived":
        return `失注から${toStage?.name ?? "不明"}へ復活`;
      case "reason_updated":
        if (history.pendingReason !== null) {
          return `検討理由を更新`;
        }
        if (history.lostReason !== null) {
          return `失注理由を更新`;
        }
        return `理由を更新`;
      default:
        return "";
    }
  };

  // 論理削除されていない履歴のみをフィルタし、グループ化
  const groupedHistories = useMemo(() => {
    const validHistories = histories.filter((h) => !h.isVoided);

    const groups: HistoryGroup[] = [];
    const groupMap = new Map<string, HistoryGroup>();

    validHistories.forEach((history) => {
      const recordedAtDate = new Date(history.recordedAt);
      const seconds = Math.floor(recordedAtDate.getTime() / 1000);
      const key = seconds.toString();

      if (groupMap.has(key)) {
        const group = groupMap.get(key)!;
        group.events.push(history);
        if (!group.note && history.note) {
          group.note = history.note;
        }
        if (!group.lostReason && history.lostReason) {
          group.lostReason = history.lostReason;
        }
        if (!group.pendingReason && history.pendingReason) {
          group.pendingReason = history.pendingReason;
        }
      } else {
        const group: HistoryGroup = {
          recordedAt: recordedAtDate,
          changedBy: history.changedBy,
          note: history.note,
          lostReason: history.lostReason,
          pendingReason: history.pendingReason,
          events: [history],
        };
        groupMap.set(key, group);
        groups.push(group);
      }
    });

    groups.forEach((group) => {
      group.events.sort((a, b) => {
        const priorityA = EVENT_PRIORITY[a.eventType] ?? 99;
        const priorityB = EVENT_PRIORITY[b.eventType] ?? 99;
        return priorityA - priorityB;
      });
    });

    return groups;
  }, [histories]);

  const totalCount = groupedHistories.length;
  const displayGroups = groupedHistories.slice(0, displayCount);
  const remainingCount = totalCount - displayCount;
  const hasMore = displayCount < totalCount;

  const handleShowMore = () => {
    setDisplayCount((prev) => Math.min(prev + 5, totalCount));
  };

  if (groupedHistories.length === 0) {
    return (
      <div className="rounded-lg border bg-card p-4">
        <h3 className="font-semibold text-xs uppercase tracking-wider text-muted-foreground mb-2">
          履歴
        </h3>
        <p className="text-sm text-muted-foreground">履歴がありません</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">
          履歴
        </h3>
        <span className="text-[11px] text-muted-foreground">
          {Math.min(displayCount, totalCount)}/{totalCount}件
        </span>
      </div>

      {/* タイムライン */}
      <div className="relative">
        {/* タイムラインの縦線 */}
        <div className="absolute left-[5px] top-1 bottom-1 w-px bg-border" />

        <div className="space-y-3">
          {displayGroups.map((group, groupIndex) => {
            const primaryEvent = group.events[0];
            const dotColor = EVENT_DOT_COLORS[primaryEvent.eventType] ?? "bg-gray-400";

            return (
              <div key={groupIndex} className="relative pl-5">
                {/* タイムラインドット */}
                <div className={cn(
                  "absolute left-0.5 top-1.5 w-2 h-2 rounded-full ring-2 ring-background",
                  dotColor
                )} />

                {/* コンテンツ */}
                <div>
                  {/* 日時 */}
                  <div className="text-[11px] text-muted-foreground mb-0.5">
                    {formatDateTime(group.recordedAt)}
                    {group.changedBy && (
                      <span className="ml-1.5">{group.changedBy}</span>
                    )}
                  </div>

                  {/* イベント */}
                  {group.events.map((event) => {
                    const { label, icon } = getEventLabel(event.eventType, event.subType);
                    return (
                      <div
                        key={event.id}
                        className="flex items-baseline gap-1.5 text-sm leading-snug"
                      >
                        <span className="text-xs shrink-0">{icon}</span>
                        <span className="text-muted-foreground text-xs shrink-0">{label}</span>
                        <span className="text-sm">{getEventDescription(event)}</span>
                      </div>
                    );
                  })}

                  {/* 理由・メモ（コンパクト表示） */}
                  {(group.lostReason || group.pendingReason || group.note) && (
                    <div className="mt-1 text-xs text-muted-foreground bg-muted/40 rounded px-2 py-1 space-y-0.5">
                      {group.lostReason && (
                        <p><span className="font-medium">失注理由:</span> {group.lostReason}</p>
                      )}
                      {group.pendingReason && (
                        <p><span className="font-medium">検討理由:</span> {group.pendingReason}</p>
                      )}
                      {group.note && (
                        <p><span className="font-medium">メモ:</span> {group.note}</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* もっと見るボタン */}
      {hasMore && (
        <Button
          variant="ghost"
          size="sm"
          onClick={handleShowMore}
          className="mt-3 w-full text-xs h-7"
        >
          もっと見る (残り{remainingCount}件)
        </Button>
      )}
    </div>
  );
}
