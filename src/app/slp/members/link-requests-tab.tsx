"use client";

import { useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { LinkResolveModal, type LinkRequestRow } from "./link-resolve-modal";

type Props = {
  requests: LinkRequestRow[];
};

const STATUS_BADGE: Record<
  string,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline"; className?: string }
> = {
  pending_friend_sync: {
    label: "友達同期待ち",
    variant: "secondary",
    className: "bg-amber-100 text-amber-900",
  },
  pending_staff_review: {
    label: "要対応",
    variant: "destructive",
  },
  email_not_found: {
    label: "メアド未発見",
    variant: "destructive",
    className: "bg-red-700",
  },
  resolved_auto: {
    label: "自動完了",
    variant: "default",
    className: "bg-green-600",
  },
  resolved_manual: {
    label: "手動完了",
    variant: "default",
    className: "bg-blue-600",
  },
  rejected: {
    label: "却下",
    variant: "outline",
  },
};

const REASON_SHORT: Record<string, string> = {
  line_name_mismatch: "LINE名不一致",
  email_multiple_match: "メアド重複",
  uid_already_linked: "uid既紐付き",
  member_deleted: "組合員削除済",
  contract_canceled: "契約破棄",
  status_not_sent: "未送付/送付エラー",
  invalid_data: "無効データ",
};

// 未完了ステータス（デフォルトで表示される）
// - pending_friend_sync : 友達同期待ち（cronで自動解決されるが、可視化のため表示）
// - pending_staff_review: スタッフ要対応
// - email_not_found     : メアド未発見（スタッフ対応必須）
const UNFINISHED_STATUSES = new Set([
  "pending_friend_sync",
  "pending_staff_review",
  "email_not_found",
]);

// 「要スタッフ対応」として赤バッジでカウントするステータス
const STAFF_ACTION_REQUIRED_STATUSES = new Set([
  "pending_staff_review",
  "email_not_found",
]);

export function LinkRequestsTab({ requests }: Props) {
  const [showAll, setShowAll] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<LinkRequestRow | null>(
    null
  );

  const visibleRequests = useMemo(() => {
    if (showAll) return requests;
    return requests.filter((r) => UNFINISHED_STATUSES.has(r.status));
  }, [requests, showAll]);

  const needsActionCount = useMemo(
    () =>
      requests.filter((r) => STAFF_ACTION_REQUIRED_STATUSES.has(r.status))
        .length,
    [requests]
  );
  const waitingSyncCount = useMemo(
    () =>
      requests.filter((r) => r.status === "pending_friend_sync").length,
    [requests]
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-sm flex items-center gap-3">
          {needsActionCount > 0 ? (
            <span className="text-red-700 font-medium">
              要対応: {needsActionCount}件
            </span>
          ) : (
            <span className="text-muted-foreground">要対応の申請はありません</span>
          )}
          {waitingSyncCount > 0 && (
            <span className="text-amber-700">
              友達同期待ち: {waitingSyncCount}件
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Checkbox
            id="show-all-link-requests"
            checked={showAll}
            onCheckedChange={(v) => setShowAll(v === true)}
          />
          <label htmlFor="show-all-link-requests" className="text-sm">
            完了・却下済みも表示
          </label>
        </div>
      </div>

      <div className="border rounded-lg overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[80px]">申請ID</TableHead>
              <TableHead className="w-[120px]">申請日時</TableHead>
              <TableHead className="w-[140px]">ステータス</TableHead>
              <TableHead className="w-[160px]">理由</TableHead>
              <TableHead>送信メアド</TableHead>
              <TableHead>送信LINE名</TableHead>
              <TableHead>紐付け先</TableHead>
              <TableHead className="w-[100px] text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibleRequests.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                  表示する申請がありません
                </TableCell>
              </TableRow>
            ) : (
              visibleRequests.map((r) => {
                const badge = STATUS_BADGE[r.status] ?? {
                  label: r.status,
                  variant: "outline" as const,
                };
                return (
                  <TableRow key={r.id}>
                    <TableCell className="text-xs font-mono">#{r.id}</TableCell>
                    <TableCell className="text-xs whitespace-nowrap">
                      {r.createdAt}
                    </TableCell>
                    <TableCell>
                      <Badge variant={badge.variant} className={badge.className}>
                        {badge.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">
                      {r.reviewReason
                        ? REASON_SHORT[r.reviewReason] ?? r.reviewReason
                        : "-"}
                    </TableCell>
                    <TableCell className="text-xs font-mono break-all max-w-[200px]">
                      {r.submittedEmail}
                    </TableCell>
                    <TableCell className="text-xs">
                      {r.submittedLineName ?? "-"}
                    </TableCell>
                    <TableCell className="text-xs">
                      {r.resolvedMemberId ? (
                        <>
                          #{r.resolvedMemberId} {r.resolvedMemberName ?? ""}
                        </>
                      ) : (
                        "-"
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedRequest(r);
                          setModalOpen(true);
                        }}
                      >
                        詳細・対応
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <LinkResolveModal
        open={modalOpen}
        onOpenChange={(open) => {
          setModalOpen(open);
          if (!open) setSelectedRequest(null);
        }}
        request={selectedRequest}
      />
    </div>
  );
}
