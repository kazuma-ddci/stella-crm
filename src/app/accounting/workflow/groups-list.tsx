"use client";

import { useState, useMemo, useCallback, useTransition } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { FileText, CreditCard, ChevronRight, Check, Clock, AlertCircle, AlertTriangle, Ban, UserCheck } from "lucide-react";
import type { WorkflowGroup } from "./actions";
import { approvePaymentGroup, rejectPaymentGroup } from "./actions";
import { ApprovalDetailModal } from "./approval-detail-modal";

type Props = {
  groups: WorkflowGroup[];
  projects: { id: number; code: string; name: string }[];
};

// 各条件のバッジ表示
function ConditionBadges({ group }: { group: WorkflowGroup }) {
  if (group.category === "pending_project_overdue") {
    const days = group.daysUntilPayment;
    const label = days != null && days <= 0
      ? "期限超過"
      : `あと${days}日`;
    return (
      <div className="flex gap-1 flex-wrap items-center">
        <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 text-xs">
          <AlertTriangle className="h-3 w-3 mr-0.5" />
          プロジェクト未承認
        </Badge>
        <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-xs">
          {label}
        </Badge>
        {group.approverName && (
          <span className="text-xs text-muted-foreground">
            承認者: {group.approverName}
          </span>
        )}
      </div>
    );
  }

  if (group.category === "pending_accounting_approval") {
    return (
      <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200 text-xs">
        <UserCheck className="h-3 w-3 mr-0.5" />
        経理承認待ち
      </Badge>
    );
  }

  if (group.category === "needs_journal") {
    return (
      <div className="flex gap-1 flex-wrap">
        <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 text-xs">
          仕訳 {group.journalizedCount}/{group.transactionCount}
        </Badge>
      </div>
    );
  }

  if (group.category === "in_progress") {
    return (
      <div className="flex gap-1 flex-wrap">
        {group.isAllRealized ? (
          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-xs">
            <Check className="h-3 w-3 mr-0.5" />
            実現
          </Badge>
        ) : (
          <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200 text-xs">
            <Clock className="h-3 w-3 mr-0.5" />
            実現 {group.allRealizedCount}/{group.transactionCount}
          </Badge>
        )}
        {group.hasActualPaymentDate ? (
          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-xs">
            <Check className="h-3 w-3 mr-0.5" />
            入出金
          </Badge>
        ) : (
          <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200 text-xs">
            <Clock className="h-3 w-3 mr-0.5" />
            入出金
          </Badge>
        )}
      </div>
    );
  }

  if (group.category === "completed") {
    return (
      <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-xs">
        <Check className="h-3 w-3 mr-0.5" />
        完了
      </Badge>
    );
  }

  // returned
  return (
    <Badge variant="outline" className="bg-gray-50 text-gray-600 border-gray-200 text-xs">
      <Ban className="h-3 w-3 mr-0.5" />
      プロジェクト対応待ち
    </Badge>
  );
}

function ApprovalActions({
  group,
  onOpenDetail,
}: {
  group: WorkflowGroup;
  onOpenDetail: (id: number) => void;
}) {
  if (group.groupType !== "payment" || group.category !== "pending_accounting_approval") {
    return null;
  }

  return (
    <Button
      size="sm"
      variant="default"
      className="h-7 text-xs bg-green-600 hover:bg-green-700"
      onClick={() => onOpenDetail(group.id)}
    >
      確認・承認
    </Button>
  );
}

function GroupTable({
  groups,
  showApprovalActions = false,
  onOpenDetail,
}: {
  groups: WorkflowGroup[];
  showApprovalActions?: boolean;
  onOpenDetail?: (id: number) => void;
}) {
  if (groups.length === 0) {
    return (
      <p className="text-muted-foreground text-center py-12">
        該当するグループはありません
      </p>
    );
  }

  return (
    <div className="overflow-x-auto border rounded-lg">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[40px]">種別</TableHead>
            <TableHead>番号</TableHead>
            <TableHead>取引先</TableHead>
            <TableHead className="text-right">金額</TableHead>
            <TableHead>進捗</TableHead>
            {showApprovalActions && <TableHead className="w-[160px]">承認アクション</TableHead>}
            <TableHead className="w-[60px]">詳細</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {groups.map((g) => (
            <TableRow key={`${g.groupType}-${g.id}`} className="group/row">
              <TableCell>
                {g.groupType === "invoice" ? (
                  <div className="flex items-center gap-1">
                    <FileText className="h-4 w-4 text-green-600" />
                    <span className="text-xs text-muted-foreground">請求</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1">
                    <CreditCard className="h-4 w-4 text-red-600" />
                    <span className="text-xs text-muted-foreground">支払</span>
                  </div>
                )}
              </TableCell>
              <TableCell className="font-mono text-sm">
                {g.label}
              </TableCell>
              <TableCell className="max-w-[200px] truncate">
                {g.counterpartyName}
              </TableCell>
              <TableCell className="text-right whitespace-nowrap">
                {g.totalAmount != null
                  ? `¥${g.totalAmount.toLocaleString()}`
                  : "-"}
              </TableCell>
              <TableCell>
                <ConditionBadges group={g} />
              </TableCell>
              {showApprovalActions && (
                <TableCell>
                  <ApprovalActions group={g} onOpenDetail={onOpenDetail ?? (() => {})} />
                </TableCell>
              )}
              <TableCell>
                {g.category !== "returned" ? (
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0" asChild>
                    <Link href={`/accounting/workflow/group-detail?type=${g.groupType}&id=${g.id}`}>
                      <ChevronRight className="h-4 w-4" />
                    </Link>
                  </Button>
                ) : (
                  <span className="text-xs text-muted-foreground">-</span>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function OverdueGroupTable({ groups }: { groups: WorkflowGroup[] }) {
  if (groups.length === 0) return null;

  return (
    <div className="overflow-x-auto border border-red-200 rounded-lg">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>番号</TableHead>
            <TableHead>取引先</TableHead>
            <TableHead className="text-right">金額</TableHead>
            <TableHead>決済予定日</TableHead>
            <TableHead>承認者</TableHead>
            <TableHead>状況</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {groups.map((g) => (
            <TableRow key={`overdue-${g.id}`} className="group/row bg-red-50/30">
              <TableCell className="font-mono text-sm">{g.label}</TableCell>
              <TableCell className="max-w-[200px] truncate">{g.counterpartyName}</TableCell>
              <TableCell className="text-right whitespace-nowrap">
                {g.totalAmount != null ? `¥${g.totalAmount.toLocaleString()}` : "-"}
              </TableCell>
              <TableCell className="whitespace-nowrap">
                {g.expectedPaymentDate
                  ? new Date(g.expectedPaymentDate).toLocaleDateString("ja-JP")
                  : "-"}
              </TableCell>
              <TableCell>{g.approverName ?? "-"}</TableCell>
              <TableCell>
                <ConditionBadges group={g} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export function GroupsList({ groups, projects }: Props) {
  const [search, setSearch] = useState("");
  const [approvalModalGroupId, setApprovalModalGroupId] = useState<number | null>(null);
  const [selectedProjectIds, setSelectedProjectIds] = useState<Set<number>>(new Set());

  const toggleProject = (projectId: number) => {
    setSelectedProjectIds((prev) => {
      const next = new Set(prev);
      if (next.has(projectId)) next.delete(projectId);
      else next.add(projectId);
      return next;
    });
  };

  const applyFilters = useCallback((items: WorkflowGroup[]) => {
    let filtered = items;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      filtered = filtered.filter(
        (g) =>
          g.label.toLowerCase().includes(q) ||
          g.counterpartyName.toLowerCase().includes(q)
      );
    }
    if (selectedProjectIds.size > 0) {
      filtered = filtered.filter(
        (g) => g.projectId !== null && selectedProjectIds.has(g.projectId)
      );
    }
    return filtered;
  }, [search, selectedProjectIds]);

  const projectOverdue = useMemo(
    () => applyFilters(groups.filter((g) => g.category === "pending_project_overdue")),
    [applyFilters, groups]
  );
  const pendingApproval = useMemo(
    () => applyFilters(groups.filter((g) => g.category === "pending_accounting_approval")),
    [applyFilters, groups]
  );
  const needsJournal = useMemo(
    () => applyFilters(groups.filter((g) => g.category === "needs_journal")),
    [applyFilters, groups]
  );
  const inProgress = useMemo(
    () => applyFilters(groups.filter((g) => g.category === "in_progress")),
    [applyFilters, groups]
  );
  const completed = useMemo(
    () => applyFilters(groups.filter((g) => g.category === "completed")),
    [applyFilters, groups]
  );
  const returned = useMemo(
    () => applyFilters(groups.filter((g) => g.category === "returned")),
    [applyFilters, groups]
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <Input
          placeholder="請求番号・取引先で検索..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-64"
        />
        {projects.length > 0 && (
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground">プロジェクト:</span>
            {projects.map((p) => (
              <Button
                key={p.id}
                variant={selectedProjectIds.has(p.id) ? "default" : "outline"}
                size="sm"
                className="h-7 text-xs"
                onClick={() => toggleProject(p.id)}
              >
                {p.code}
              </Button>
            ))}
            {selectedProjectIds.size > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-muted-foreground"
                onClick={() => setSelectedProjectIds(new Set())}
              >
                クリア
              </Button>
            )}
          </div>
        )}
      </div>

      <Tabs defaultValue={projectOverdue.length > 0 ? "pending_project_overdue" : pendingApproval.length > 0 ? "pending_accounting_approval" : "needs_journal"}>
        <TabsList>
          {projectOverdue.length > 0 && (
            <TabsTrigger value="pending_project_overdue" className="gap-1">
              <AlertTriangle className="h-3.5 w-3.5 text-red-600" />
              未承認警告
              <Badge variant="destructive" className="ml-1 h-5 px-1.5 text-xs">
                {projectOverdue.length}
              </Badge>
            </TabsTrigger>
          )}
          <TabsTrigger value="pending_accounting_approval" className="gap-1">
            <UserCheck className="h-3.5 w-3.5" />
            経理承認待ち
            {pendingApproval.length > 0 && (
              <Badge variant="default" className="ml-1 h-5 px-1.5 text-xs bg-purple-600">
                {pendingApproval.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="needs_journal" className="gap-1">
            <AlertCircle className="h-3.5 w-3.5" />
            仕訳待ち
            {needsJournal.length > 0 && (
              <Badge variant="destructive" className="ml-1 h-5 px-1.5 text-xs">
                {needsJournal.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="in_progress" className="gap-1">
            <Clock className="h-3.5 w-3.5" />
            処理中
            {inProgress.length > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                {inProgress.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="completed" className="gap-1">
            <Check className="h-3.5 w-3.5" />
            完了
            <span className="ml-1 text-xs text-muted-foreground">
              {completed.length}
            </span>
          </TabsTrigger>
          {returned.length > 0 && (
            <TabsTrigger value="returned" className="gap-1">
              <Ban className="h-3.5 w-3.5" />
              差し戻し中
              <Badge variant="outline" className="ml-1 h-5 px-1.5 text-xs">
                {returned.length}
              </Badge>
            </TabsTrigger>
          )}
        </TabsList>

        {projectOverdue.length > 0 && (
          <TabsContent value="pending_project_overdue" className="mt-4 space-y-3">
            <div className="rounded border border-red-200 bg-red-50 px-4 py-3">
              <div className="flex items-center gap-2 text-sm text-red-800 font-medium">
                <AlertTriangle className="h-4 w-4" />
                決済予定日が5日以内にも関わらず、プロジェクト側の承認が完了していない定期経費があります。承認者に確認してください。
              </div>
            </div>
            <OverdueGroupTable groups={projectOverdue} />
          </TabsContent>
        )}

        <TabsContent value="pending_accounting_approval" className="mt-4">
          <GroupTable
            groups={pendingApproval}
            showApprovalActions
            onOpenDetail={setApprovalModalGroupId}
          />
        </TabsContent>

        <TabsContent value="needs_journal" className="mt-4">
          <GroupTable groups={needsJournal} />
        </TabsContent>

        <TabsContent value="in_progress" className="mt-4">
          <GroupTable groups={inProgress} />
        </TabsContent>

        <TabsContent value="completed" className="mt-4">
          <GroupTable groups={completed} />
        </TabsContent>

        <TabsContent value="returned" className="mt-4">
          <GroupTable groups={returned} />
        </TabsContent>
      </Tabs>

      <ApprovalDetailModal
        groupId={approvalModalGroupId}
        open={approvalModalGroupId !== null}
        onClose={() => setApprovalModalGroupId(null)}
      />
    </div>
  );
}
