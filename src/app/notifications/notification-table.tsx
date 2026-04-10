"use client";

import { useState, useTransition, useMemo, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Mail,
  MailOpen,
  Clock,
  CheckCircle2,
  ExternalLink,
  ChevronDown,
  CheckCheck,
  Loader2,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import {
  updateNotificationStatus,
  markAllAsRead,
  approvePaymentGroupFromNotification,
  getPaymentGroupSummary,
  type PaymentGroupSummary,
} from "./actions";
import type { NotificationRow } from "./actions";

// ============================================
// 定数
// ============================================

const STATUS_LABELS: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  unread: { label: "未読", icon: Mail, color: "bg-blue-100 text-blue-700" },
  read: { label: "既読", icon: MailOpen, color: "bg-gray-100 text-gray-700" },
  in_progress: { label: "確認中", icon: Clock, color: "bg-yellow-100 text-yellow-700" },
  completed: { label: "完了", icon: CheckCircle2, color: "bg-green-100 text-green-700" },
};

const CATEGORY_LABELS: Record<string, string> = {
  finance: "財務",
  accounting: "経理",
  kpi: "KPI",
  system: "システム",
  other: "その他",
};

const CATEGORY_COLORS: Record<string, string> = {
  finance: "bg-purple-100 text-purple-700",
  accounting: "bg-indigo-100 text-indigo-700",
  kpi: "bg-orange-100 text-orange-700",
  system: "bg-gray-100 text-gray-700",
  other: "bg-slate-100 text-slate-700",
};

// ============================================
// ステータスバッジ
// ============================================

function NotificationStatusBadge({ status }: { status: string }) {
  const config = STATUS_LABELS[status];
  if (!config) return <span>{status}</span>;
  const Icon = config.icon;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${config.color}`}
    >
      <Icon className="h-3 w-3" />
      {config.label}
    </span>
  );
}

// ============================================
// カテゴリバッジ
// ============================================

function CategoryBadge({ category }: { category: string }) {
  const label = CATEGORY_LABELS[category] ?? category;
  const color = CATEGORY_COLORS[category] ?? "bg-gray-100 text-gray-700";
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${color}`}>
      {label}
    </span>
  );
}

// ============================================
// 承認アクションパネル
// ============================================

const PG_STATUS_LABELS: Record<string, string> = {
  pending_approval: "承認待ち",
  before_request: "依頼前（承認済み）",
  requested: "依頼済み",
  confirmed: "確認済み",
  paid: "支払済み",
};

function ApprovalActionPanel({
  notification,
  onApproved,
}: {
  notification: NotificationRow;
  onApproved: () => void;
}) {
  const [summary, setSummary] = useState<PaymentGroupSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState(false);

  const loadSummary = useCallback(async () => {
    if (!notification.actionTargetId) return;
    setLoading(true);
    try {
      const data = await getPaymentGroupSummary(notification.actionTargetId);
      setSummary(data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [notification.actionTargetId]);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  const handleApprove = async () => {
    if (!confirm("この支払を承認しますか？")) return;
    setApproving(true);
    try {
      const result = await approvePaymentGroupFromNotification(notification.id);
      if (!result.ok) {
        toast.error(result.error || "承認に失敗しました");
        return;
      }
      toast.success("承認しました");
      onApproved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "承認に失敗しました");
    } finally {
      setApproving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-3 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        読み込み中...
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="py-3 text-sm text-muted-foreground">
        支払グループが見つかりません（削除された可能性があります）
      </div>
    );
  }

  const isPending = summary.status === "pending_approval";
  const isAlreadyDone = notification.status === "completed";

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
        <div>
          <div className="text-muted-foreground">取引先</div>
          <div className="font-medium">{summary.counterpartyName}</div>
        </div>
        <div>
          <div className="text-muted-foreground">支払元法人</div>
          <div className="font-medium">{summary.operatingCompanyName}</div>
        </div>
        <div>
          <div className="text-muted-foreground">金額（税込）</div>
          <div className="font-medium">
            {summary.totalAmount != null ? `¥${summary.totalAmount.toLocaleString()}` : "-"}
          </div>
        </div>
        <div>
          <div className="text-muted-foreground">明細数</div>
          <div className="font-medium">{summary.transactionCount}件</div>
        </div>
        <div>
          <div className="text-muted-foreground">作成者</div>
          <div className="font-medium">{summary.createdByName}</div>
        </div>
        <div>
          <div className="text-muted-foreground">ステータス</div>
          <div className="font-medium">{PG_STATUS_LABELS[summary.status] ?? summary.status}</div>
        </div>
      </div>

      {isPending && !isAlreadyDone ? (
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={handleApprove}
            disabled={approving}
          >
            {approving ? (
              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
            ) : (
              <ShieldCheck className="mr-1 h-4 w-4" />
            )}
            承認する
          </Button>
          <Link href="/stp/finance/payment-groups">
            <Button variant="outline" size="sm">
              支払管理で確認
              <ExternalLink className="ml-1 h-3 w-3" />
            </Button>
          </Link>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-full bg-green-50 border border-green-200 px-2.5 py-1 text-xs font-medium text-green-700">
            <CheckCircle2 className="h-3.5 w-3.5" />
            承認済み
          </span>
          <Link href="/stp/finance/payment-groups">
            <Button variant="outline" size="sm">
              支払管理で確認
              <ExternalLink className="ml-1 h-3 w-3" />
            </Button>
          </Link>
        </div>
      )}
    </div>
  );
}

// ============================================
// メインコンポーネント
// ============================================

type Props = {
  notifications: NotificationRow[];
};

export function NotificationTable({ notifications }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [expandedId, setExpandedId] = useState<number | null>(null);

  // フィルタリング
  const filteredNotifications = useMemo(() => {
    let result = notifications;

    if (statusFilter !== "all") {
      result = result.filter((n) => n.status === statusFilter);
    }

    if (categoryFilter !== "all") {
      result = result.filter((n) => n.category === categoryFilter);
    }

    return result;
  }, [notifications, statusFilter, categoryFilter]);

  const handleStatusChange = (id: number, newStatus: string) => {
    startTransition(async () => {
      try {
        const result = await updateNotificationStatus(id, newStatus);
        if (!result.ok) {
          toast.error(result.error || "ステータスの更新に失敗しました");
          return;
        }
        toast.success("ステータスを更新しました");
        router.refresh();
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "ステータスの更新に失敗しました"
        );
      }
    });
  };

  const handleMarkAllAsRead = () => {
    startTransition(async () => {
      try {
        const result = await markAllAsRead();
        if (!result.ok) {
          toast.error(result.error || "一括既読に失敗しました");
          return;
        }
        toast.success("全て既読にしました");
        router.refresh();
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "一括既読に失敗しました"
        );
      }
    });
  };

  const unreadCount = notifications.filter((n) => n.status === "unread").length;

  return (
    <div className="space-y-4">
      {/* フィルタ・操作バー */}
      <div className="flex items-center gap-3 flex-wrap">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全てのステータス</SelectItem>
            <SelectItem value="unread">未読</SelectItem>
            <SelectItem value="read">既読</SelectItem>
            <SelectItem value="in_progress">確認中</SelectItem>
            <SelectItem value="completed">完了</SelectItem>
          </SelectContent>
        </Select>

        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全てのカテゴリ</SelectItem>
            <SelectItem value="finance">財務</SelectItem>
            <SelectItem value="accounting">経理</SelectItem>
            <SelectItem value="kpi">KPI</SelectItem>
            <SelectItem value="system">システム</SelectItem>
            <SelectItem value="other">その他</SelectItem>
          </SelectContent>
        </Select>

        {unreadCount > 0 && (
          <div className="ml-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={handleMarkAllAsRead}
              disabled={isPending}
            >
              <CheckCheck className="h-4 w-4 mr-1" />
              全て既読にする
            </Button>
          </div>
        )}
      </div>

      {/* テーブル */}
      {filteredNotifications.length === 0 ? (
        <p className="text-muted-foreground text-center py-8">
          通知がありません
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left">
                <th className="px-3 py-2 font-medium">ステータス</th>
                <th className="px-3 py-2 font-medium">カテゴリ</th>
                <th className="px-3 py-2 font-medium">タイトル</th>
                <th className="px-3 py-2 font-medium">メッセージ</th>
                <th className="px-3 py-2 font-medium">送信元</th>
                <th className="px-3 py-2 font-medium">日時</th>
                <th className="px-3 py-2 font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {filteredNotifications.map((notification) => {
                const hasAction = !!notification.actionType;
                const isExpanded = expandedId === notification.id;
                return (
                  <>
                    <tr
                      key={notification.id}
                      className={`border-b hover:bg-muted/50 group/row ${
                        notification.status === "unread" ? "bg-blue-50/50" : ""
                      } ${hasAction ? "cursor-pointer" : ""}`}
                      onClick={hasAction ? () => setExpandedId(isExpanded ? null : notification.id) : undefined}
                    >
                      <td className="px-3 py-2">
                        <NotificationStatusBadge status={notification.status} />
                      </td>
                      <td className="px-3 py-2">
                        <CategoryBadge category={notification.category} />
                      </td>
                      <td className="px-3 py-2 font-medium max-w-[200px]">
                        <div className="truncate">
                          {hasAction && (
                            <ShieldCheck className="inline h-3.5 w-3.5 mr-1 text-amber-500" />
                          )}
                          {notification.title}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-muted-foreground max-w-[300px]">
                        <div className="truncate">{notification.message}</div>
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">
                        {notification.senderType === "system"
                          ? "システム"
                          : notification.sender?.name ?? "-"}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">
                        {new Date(notification.createdAt).toLocaleString("ja-JP", {
                          month: "numeric",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-1">
                          {/* ステータス変更 */}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 px-2"
                                disabled={isPending}
                              >
                                変更
                                <ChevronDown className="h-3 w-3 ml-1" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {(["unread", "read", "in_progress", "completed"] as const).map(
                                (s) =>
                                  s !== notification.status && (
                                    <DropdownMenuItem
                                      key={s}
                                      onClick={() =>
                                        handleStatusChange(notification.id, s)
                                      }
                                    >
                                      {STATUS_LABELS[s].label}にする
                                    </DropdownMenuItem>
                                  )
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>

                          {/* リンク遷移 */}
                          {notification.linkUrl && !hasAction && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                              asChild
                            >
                              <Link href={notification.linkUrl}>
                                <ExternalLink className="h-4 w-4" />
                              </Link>
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                    {/* 展開パネル */}
                    {isExpanded && hasAction && (
                      <tr key={`${notification.id}-detail`} className="border-b bg-gray-50/50">
                        <td colSpan={7} className="px-6 py-4">
                          {notification.actionType === "payment_group_approval" && (
                            <ApprovalActionPanel
                              notification={notification}
                              onApproved={() => {
                                setExpandedId(null);
                                router.refresh();
                              }}
                            />
                          )}
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
