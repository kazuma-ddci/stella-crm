"use client";

import { useState, useTransition, useMemo } from "react";
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
} from "lucide-react";
import { toast } from "sonner";
import { updateNotificationStatus, markAllAsRead } from "./actions";
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
        await updateNotificationStatus(id, newStatus);
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
        await markAllAsRead();
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
              {filteredNotifications.map((notification) => (
                <tr
                  key={notification.id}
                  className={`border-b hover:bg-muted/50 group/row ${
                    notification.status === "unread" ? "bg-blue-50/50" : ""
                  }`}
                >
                  <td className="px-3 py-2">
                    <NotificationStatusBadge status={notification.status} />
                  </td>
                  <td className="px-3 py-2">
                    <CategoryBadge category={notification.category} />
                  </td>
                  <td className="px-3 py-2 font-medium max-w-[200px]">
                    <div className="truncate">{notification.title}</div>
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
                  <td className="px-3 py-2">
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
                      {notification.linkUrl && (
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
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
