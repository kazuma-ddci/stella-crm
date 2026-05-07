"use client";

import { useState, useMemo, useCallback, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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
import { FileText, CreditCard, ChevronRight, Check, Clock, AlertCircle, AlertTriangle, Ban, UserCheck, Link2, Undo2 } from "lucide-react";
import { toast } from "sonner";
import type { WorkflowGroup } from "./actions";
import { bulkRealizeJournalEntries, type DueUnrealizedJournalEntry } from "../journal/actions";
import { ApprovalDetailModal } from "./approval-detail-modal";

type Props = {
  groups: WorkflowGroup[];
  projects: { id: number; code: string; name: string }[];
  dueUnrealizedEntries: DueUnrealizedJournalEntry[];
};

// 入金/支払の手動ステータスバッジ（経理が手動で切り替えた状態を表示）
function ManualPaymentStatusBadge({ group }: { group: WorkflowGroup }) {
  const label = group.groupType === "invoice" ? "入金" : "支払";
  if (group.manualPaymentStatus === "completed") {
    return (
      <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-xs">
        <Check className="h-3 w-3 mr-0.5" />
        {label}完了
        {group.actualPaymentDate && (
          <span className="ml-1 font-mono">
            ({new Date(group.actualPaymentDate).toLocaleDateString("ja-JP")})
          </span>
        )}
      </Badge>
    );
  }
  if (group.manualPaymentStatus === "partial") {
    return (
      <Badge variant="outline" className="bg-red-50 text-red-700 border-red-300 text-xs">
        {label}一部のみ
        {group.actualPaymentDate && (
          <span className="ml-1 font-mono">
            ({new Date(group.actualPaymentDate).toLocaleDateString("ja-JP")})
          </span>
        )}
      </Badge>
    );
  }
  // unpaid
  return (
    <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200 text-xs">
      <Clock className="h-3 w-3 mr-0.5" />
      未{label}
    </Badge>
  );
}

function StatementCheckBadge({ group }: { group: WorkflowGroup }) {
  if (group.statementLinkCompleted) {
    return (
      <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-xs">
        <Check className="h-3 w-3 mr-0.5" />
        入出金履歴チェック: 完了（{group.statementLinkCount}件）
      </Badge>
    );
  }

  return (
    <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200 text-xs">
      <Clock className="h-3 w-3 mr-0.5" />
      入出金履歴チェック: 未完了（{group.statementLinkCount}件）
    </Badge>
  );
}

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

  if (group.category === "return_requested") {
    return (
      <div className="flex gap-1 flex-wrap items-center">
        <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-300 text-xs">
          <Undo2 className="h-3 w-3 mr-0.5" />
          差し戻し依頼あり
        </Badge>
        {group.returnRequestReason && (
          <span className="text-xs text-muted-foreground max-w-[260px] truncate">
            {group.returnRequestReason}
          </span>
        )}
      </div>
    );
  }

  if (group.category === "needs_journal") {
    return (
      <div className="flex gap-1 flex-wrap">
        <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 text-xs">
          仕訳作成: {group.journalizedCount}/{group.transactionCount}
        </Badge>
      </div>
    );
  }

  if (group.category === "needs_realization") {
    return (
      <div className="flex gap-1 flex-wrap">
        <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200 text-xs">
          <Clock className="h-3 w-3 mr-0.5" />
          仕訳実現: {group.allRealizedCount}/{group.transactionCount}
        </Badge>
      </div>
    );
  }

  if (group.category === "needs_statement_check") {
    return (
      <div className="flex gap-1 flex-wrap">
        <ManualPaymentStatusBadge group={group} />
        <StatementCheckBadge group={group} />
      </div>
    );
  }

  if (group.category === "completed") {
    return (
      <div className="flex gap-1 flex-wrap items-center">
        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-xs">
          <Check className="h-3 w-3 mr-0.5" />
          完了
        </Badge>
        <StatementCheckBadge group={group} />
      </div>
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
                {g.category !== "returned" || g.returnRequestStatus === "requested" ? (
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

function getDueEntrySource(entry: DueUnrealizedJournalEntry) {
  if (entry.invoiceGroup) {
    return {
      label: entry.invoiceGroup.invoiceNumber ?? `INV-${entry.invoiceGroup.id}`,
      counterpartyName: entry.invoiceGroup.counterparty?.name ?? entry.counterparty?.name ?? "-",
      href: `/accounting/workflow/group-detail?type=invoice&id=${entry.invoiceGroup.id}`,
    };
  }
  if (entry.paymentGroup) {
    return {
      label: entry.paymentGroup.referenceCode ?? `PG-${entry.paymentGroup.id}`,
      counterpartyName: entry.paymentGroup.counterparty?.name ?? entry.counterparty?.name ?? "-",
      href: `/accounting/workflow/group-detail?type=payment&id=${entry.paymentGroup.id}`,
    };
  }
  if (entry.transaction) {
    return {
      label: `取引 #${entry.transaction.id}`,
      counterpartyName: entry.transaction.counterparty?.name ?? entry.counterparty?.name ?? "-",
      href: null,
    };
  }
  return {
    label: "手動仕訳",
    counterpartyName: entry.counterparty?.name ?? "-",
    href: null,
  };
}

function DueUnrealizedTable({
  entries,
  selectedIds,
  isPending,
  onToggle,
  onToggleAll,
  onRealize,
}: {
  entries: DueUnrealizedJournalEntry[];
  selectedIds: Set<number>;
  isPending: boolean;
  onToggle: (id: number) => void;
  onToggleAll: (ids: number[]) => void;
  onRealize: (ids: number[]) => void;
}) {
  if (entries.length === 0) {
    return (
      <p className="text-muted-foreground text-center py-12">
        本日実現する仕訳はありません
      </p>
    );
  }

  const entryIds = entries.map((entry) => entry.id);
  const allSelected = entryIds.every((id) => selectedIds.has(id));
  const selectedCount = entryIds.filter((id) => selectedIds.has(id)).length;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 rounded border bg-blue-50 px-4 py-3">
        <div>
          <div className="text-sm font-medium text-blue-900">
            仕訳日が今日以前の未実現仕訳
          </div>
          <div className="text-xs text-blue-800/80">
            確定済みの仕訳だけを表示しています。
          </div>
        </div>
        <Button
          size="sm"
          onClick={() => onRealize(entryIds.filter((id) => selectedIds.has(id)))}
          disabled={isPending || selectedCount === 0}
        >
          {isPending ? "実現中..." : `選択した仕訳を実現 (${selectedCount}件)`}
        </Button>
      </div>
      <div className="overflow-x-auto border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[40px]">
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={() => onToggleAll(entryIds)}
                  aria-label="本日実現待ち仕訳をすべて選択"
                />
              </TableHead>
              <TableHead>仕訳日</TableHead>
              <TableHead>摘要</TableHead>
              <TableHead>取引先</TableHead>
              <TableHead>紐づき</TableHead>
              <TableHead>プロジェクト</TableHead>
              <TableHead className="text-right">金額</TableHead>
              <TableHead>作成者</TableHead>
              <TableHead className="w-[120px]">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.map((entry) => {
              const source = getDueEntrySource(entry);
              const amount = entry.lines
                .filter((line) => line.side === "debit")
                .reduce((sum, line) => sum + line.amount, 0);

              return (
                <TableRow key={entry.id}>
                  <TableCell>
                    <Checkbox
                      checked={selectedIds.has(entry.id)}
                      onCheckedChange={() => onToggle(entry.id)}
                      aria-label={`${entry.description}を選択`}
                    />
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {new Date(entry.journalDate).toLocaleDateString("ja-JP")}
                  </TableCell>
                  <TableCell className="max-w-[280px] truncate">
                    {entry.description}
                  </TableCell>
                  <TableCell className="max-w-[180px] truncate">
                    {source.counterpartyName}
                  </TableCell>
                  <TableCell className="font-mono text-sm whitespace-nowrap">
                    {source.href ? (
                      <Link className="text-blue-700 hover:underline" href={source.href}>
                        {source.label}
                      </Link>
                    ) : (
                      source.label
                    )}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {entry.project ? `${entry.project.code} ${entry.project.name}` : "-"}
                  </TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    ¥{amount.toLocaleString()}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {entry.creator?.name ?? "-"}
                  </TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs"
                      onClick={() => onRealize([entry.id])}
                      disabled={isPending}
                    >
                      実現にする
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
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

export function GroupsList({ groups, projects, dueUnrealizedEntries }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [search, setSearch] = useState("");
  const [approvalModalGroupId, setApprovalModalGroupId] = useState<number | null>(null);
  const [selectedProjectIds, setSelectedProjectIds] = useState<Set<number>>(new Set());
  const [selectedDueEntryIds, setSelectedDueEntryIds] = useState<Set<number>>(new Set());

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

  const applyDueEntryFilters = useCallback((items: DueUnrealizedJournalEntry[]) => {
    let filtered = items;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      filtered = filtered.filter((entry) => {
        const source = getDueEntrySource(entry);
        return (
          entry.description.toLowerCase().includes(q) ||
          source.label.toLowerCase().includes(q) ||
          source.counterpartyName.toLowerCase().includes(q) ||
          entry.project?.code.toLowerCase().includes(q) ||
          entry.project?.name.toLowerCase().includes(q)
        );
      });
    }
    if (selectedProjectIds.size > 0) {
      filtered = filtered.filter(
        (entry) => entry.projectId !== null && selectedProjectIds.has(entry.projectId)
      );
    }
    return filtered;
  }, [search, selectedProjectIds]);

  const toggleDueEntry = (id: number) => {
    setSelectedDueEntryIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleDueEntries = (ids: number[]) => {
    setSelectedDueEntryIds((prev) => {
      const next = new Set(prev);
      const allSelected = ids.length > 0 && ids.every((id) => next.has(id));
      if (allSelected) ids.forEach((id) => next.delete(id));
      else ids.forEach((id) => next.add(id));
      return next;
    });
  };

  const handleRealizeEntries = (ids: number[]) => {
    if (ids.length === 0) {
      toast.error("実現にする仕訳を選択してください");
      return;
    }

    startTransition(async () => {
      const result = await bulkRealizeJournalEntries(ids);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`${result.data.count}件の仕訳を実現にしました`);
      setSelectedDueEntryIds(new Set());
      router.refresh();
    });
  };

  const projectOverdue = useMemo(
    () => applyFilters(groups.filter((g) => g.category === "pending_project_overdue")),
    [applyFilters, groups]
  );
  const dueUnrealized = useMemo(
    () => applyDueEntryFilters(dueUnrealizedEntries),
    [applyDueEntryFilters, dueUnrealizedEntries]
  );
  const pendingApproval = useMemo(
    () => applyFilters(groups.filter((g) => g.category === "pending_accounting_approval")),
    [applyFilters, groups]
  );
  const returnRequested = useMemo(
    () => applyFilters(groups.filter((g) => g.category === "return_requested")),
    [applyFilters, groups]
  );
  const needsJournal = useMemo(
    () => applyFilters(groups.filter((g) => g.category === "needs_journal")),
    [applyFilters, groups]
  );
  const needsRealization = useMemo(
    () => applyFilters(groups.filter((g) => g.category === "needs_realization")),
    [applyFilters, groups]
  );
  const needsStatementCheck = useMemo(
    () => applyFilters(groups.filter((g) => g.category === "needs_statement_check")),
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

  const defaultTab =
    projectOverdue.length > 0
      ? "pending_project_overdue"
      : pendingApproval.length > 0
        ? "pending_accounting_approval"
        : returnRequested.length > 0
          ? "return_requested"
          : dueUnrealized.length > 0
            ? "due_unrealized"
            : needsJournal.length > 0
              ? "needs_journal"
              : needsRealization.length > 0
                ? "needs_realization"
                : needsStatementCheck.length > 0
                  ? "needs_statement_check"
                  : returned.length > 0
                    ? "returned"
                    : "completed";

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

      <Tabs defaultValue={defaultTab}>
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
          <TabsTrigger value="return_requested" className="gap-1">
            <Undo2 className="h-3.5 w-3.5" />
            差し戻し依頼
            {returnRequested.length > 0 && (
              <Badge variant="default" className="ml-1 h-5 px-1.5 text-xs bg-amber-600">
                {returnRequested.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="due_unrealized" className="gap-1">
            <Clock className="h-3.5 w-3.5" />
            本日実現待ち
            {dueUnrealized.length > 0 && (
              <Badge variant="default" className="ml-1 h-5 px-1.5 text-xs bg-blue-600">
                {dueUnrealized.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="needs_journal" className="gap-1">
            <AlertCircle className="h-3.5 w-3.5" />
            仕訳作成待ち
            {needsJournal.length > 0 && (
              <Badge variant="destructive" className="ml-1 h-5 px-1.5 text-xs">
                {needsJournal.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="needs_realization" className="gap-1">
            <Clock className="h-3.5 w-3.5" />
            仕訳実現待ち
            {needsRealization.length > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                {needsRealization.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="needs_statement_check" className="gap-1">
            <Link2 className="h-3.5 w-3.5" />
            入出金確認待ち
            {needsStatementCheck.length > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                {needsStatementCheck.length}
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

        <TabsContent value="return_requested" className="mt-4">
          <GroupTable groups={returnRequested} />
        </TabsContent>

        <TabsContent value="due_unrealized" className="mt-4">
          <DueUnrealizedTable
            entries={dueUnrealized}
            selectedIds={selectedDueEntryIds}
            isPending={isPending}
            onToggle={toggleDueEntry}
            onToggleAll={toggleDueEntries}
            onRealize={handleRealizeEntries}
          />
        </TabsContent>

        <TabsContent value="needs_journal" className="mt-4">
          <GroupTable groups={needsJournal} />
        </TabsContent>

        <TabsContent value="needs_realization" className="mt-4">
          <GroupTable groups={needsRealization} />
        </TabsContent>

        <TabsContent value="needs_statement_check" className="mt-4">
          <GroupTable groups={needsStatementCheck} />
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
