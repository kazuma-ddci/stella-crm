"use client";

import { useState, useMemo } from "react";
import { StageHistoryRecord } from "@/lib/stage-transition/types";
import { EVENT_LABELS, RECOMMIT_SUBTYPE_LABELS } from "@/lib/stage-transition/constants";
import { Button } from "@/components/ui/button";

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
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getEventLabel = (eventType: string, subType?: string | null) => {
    const event = EVENT_LABELS[eventType as keyof typeof EVENT_LABELS];
    if (!event) {
      return { label: eventType, icon: "" };
    }

    // recommitの場合、サブタイプに応じてラベルを変更
    if (eventType === "recommit" && subType) {
      const subTypeLabel = RECOMMIT_SUBTYPE_LABELS[subType];
      if (subTypeLabel) {
        return { ...event, label: `${event.label}（${subTypeLabel}）` };
      }
    }

    return event;
  };

  const getEventDescription = (history: StageHistoryRecord) => {
    const { eventType, fromStage, toStage, targetDate, subType } = history;

    switch (eventType) {
      case "commit":
        return (
          <>
            {toStage?.name ?? "不明"}を目標に設定
            {targetDate && (
              <span className="text-muted-foreground ml-1">
                （期限：{formatDate(targetDate)}）
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
              <span className="text-muted-foreground ml-1">
                （期限：{formatDate(targetDate)}）
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
        // どの理由が更新されたかを表示
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
    // 論理削除されていないもののみフィルタ
    const validHistories = histories.filter((h) => !h.isVoided);

    const groups: HistoryGroup[] = [];
    const groupMap = new Map<string, HistoryGroup>();

    validHistories.forEach((history) => {
      const recordedAtDate = new Date(history.recordedAt);
      // 秒単位でグループ化（ミリ秒を切り捨て）
      const seconds = Math.floor(recordedAtDate.getTime() / 1000);
      const key = seconds.toString();

      if (groupMap.has(key)) {
        const group = groupMap.get(key)!;
        group.events.push(history);
        // 最初のnote/lostReason/pendingReasonを保持
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

    // 各グループ内のイベントをソート（ステージ変更系を先に）
    groups.forEach((group) => {
      group.events.sort((a, b) => {
        const priorityA = EVENT_PRIORITY[a.eventType] ?? 99;
        const priorityB = EVENT_PRIORITY[b.eventType] ?? 99;
        return priorityA - priorityB;
      });
    });

    return groups;
  }, [histories]);

  // グループ数を件数としてカウント
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
        <h3 className="font-semibold text-sm text-muted-foreground mb-3">
          ステージ履歴
        </h3>
        <p className="text-sm text-muted-foreground">履歴がありません</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-card p-4">
      <h3 className="font-semibold text-sm text-muted-foreground mb-3">
        ステージ履歴
        <span className="font-normal ml-1">
          （全{totalCount}件中、最新{Math.min(displayCount, totalCount)}件を表示）
        </span>
      </h3>
      <div className="space-y-3">
        {displayGroups.map((group, groupIndex) => (
          <div
            key={groupIndex}
            className="rounded-lg border bg-muted/30 p-3"
          >
            {/* ヘッダー：日時と担当者 */}
            <div className="flex items-center justify-between mb-2 text-sm">
              <span className="text-muted-foreground">
                {formatDateTime(group.recordedAt)}
              </span>
              {group.changedBy && (
                <span className="text-muted-foreground">
                  担当：{group.changedBy}
                </span>
              )}
            </div>

            {/* イベント一覧 */}
            <div className="space-y-1.5 bg-background rounded-md p-2">
              {group.events.map((event) => {
                const { label, icon } = getEventLabel(event.eventType, event.subType);
                return (
                  <div
                    key={event.id}
                    className="flex items-center gap-2 text-sm"
                  >
                    <span>{icon}</span>
                    <span className="text-muted-foreground min-w-[80px]">
                      {label}：
                    </span>
                    <span>{getEventDescription(event)}</span>
                  </div>
                );
              })}
            </div>

            {/* 失注理由 */}
            {group.lostReason && (
              <div className="mt-2 text-sm">
                <span className="text-muted-foreground">失注理由：</span>
                <span>{group.lostReason}</span>
              </div>
            )}

            {/* 検討中理由 */}
            {group.pendingReason && (
              <div className="mt-2 text-sm">
                <span className="text-muted-foreground">検討中理由：</span>
                <span>{group.pendingReason}</span>
              </div>
            )}

            {/* メモ */}
            {group.note && (
              <div className="mt-2 text-sm">
                <span className="text-muted-foreground">メモ：</span>
                <span>{group.note}</span>
              </div>
            )}
          </div>
        ))}
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
