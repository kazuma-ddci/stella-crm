"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Plus, Trash2, Search } from "lucide-react";
import { toast } from "sonner";
import {
  listLinkCandidatesForEntry,
  listLinksForEntry,
  replaceLinksForEntry,
  type EntryLinkRow,
  type GroupKind,
  type LinkCandidate,
  type LinkConflict,
  type ConflictResolution,
} from "./link-actions";
import { ConflictResolutionDialog } from "@/components/accounting/conflict-resolution-dialog";
import { AccountingGroupCreateModal } from "../accounting-group-create-modal";

type EntrySummary = {
  id: number;
  transactionDate: string;
  description: string;
  incomingAmount: number | null;
  outgoingAmount: number | null;
};

type EditableLink = {
  // 既存リンクなら id を保持。新規は undefined。
  existingLinkId?: number;
  groupKind: GroupKind;
  groupId: number;
  groupLabel: string;
  counterpartyName: string;
  amount: number;
  note: string;
  isCrossCompany: boolean;
  operatingCompanyName: string | null;
  crossCompanyReason: string;
  linkType: StatementLinkType;
};

type StatementLinkType = "settlement" | "fee";

const CROSS_COMPANY_REASON_OPTIONS = [
  "法人間立替",
  "法人間送金",
  "口座選択ミスではないことを確認済み",
  "その他",
];

function fmt(n: number | null | undefined): string {
  if (n === null || n === undefined) return "";
  return n.toLocaleString("ja-JP");
}

function candidateRemainingAmount(candidate: LinkCandidate) {
  if (candidate.totalAmount === null) return null;
  return candidate.totalAmount - candidate.alreadyLinkedAmount;
}

export function LinkEntryModal({
  open,
  onOpenChange,
  entry,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  entry: EntrySummary;
  onSaved?: () => void;
}) {
  const [direction, setDirection] = useState<GroupKind | null>(null);
  const [links, setLinks] = useState<EditableLink[]>([]);
  const [candidates, setCandidates] = useState<LinkCandidate[]>([]);
  const [search, setSearch] = useState("");
  const [includeCrossCompany, setIncludeCrossCompany] = useState(false);
  const [feeTargetMode, setFeeTargetMode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [conflicts, setConflicts] = useState<LinkConflict[] | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const totalAmount =
    (entry.incomingAmount ?? 0) > 0
      ? entry.incomingAmount!
      : entry.outgoingAmount ?? 0;
  const allocatedSum = useMemo(
    () => links.reduce((s, l) => s + (l.amount || 0), 0),
    [links]
  );
  const hasFeeLink = links.some((l) => l.linkType === "fee");
  const remaining = totalAmount - allocatedSum;

  const load = async () => {
    setLoading(true);
    try {
      const [existingLinks, candRes] = await Promise.all([
        listLinksForEntry(entry.id),
        listLinkCandidatesForEntry({
          entryId: entry.id,
          search: "",
          includeCrossCompany,
          includeFeeTargets: feeTargetMode,
        }),
      ]);
      const existing: EditableLink[] = existingLinks.map((l: EntryLinkRow) => ({
        existingLinkId: l.id,
        groupKind: l.groupKind,
        groupId: l.groupId,
        groupLabel: l.groupLabel,
        counterpartyName: l.counterpartyName,
        amount: l.amount,
        linkType: l.linkType,
        note: l.note ?? "",
        isCrossCompany: l.isCrossCompany,
        operatingCompanyName: l.operatingCompanyName,
        crossCompanyReason: l.crossCompanyReason ?? "",
      }));
      setLinks(existing);
      if (candRes.ok) {
        setDirection(candRes.data.direction);
        setCandidates(candRes.data.candidates);
      } else {
        toast.error(candRes.error);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, entry.id]);

  const refreshCandidates = async (s: string) => {
    const res = await listLinkCandidatesForEntry({
      entryId: entry.id,
      search: s,
      includeCrossCompany,
      includeFeeTargets: feeTargetMode,
    });
    if (res.ok) {
      setCandidates(res.data.candidates);
    }
  };

  const addCandidate = (c: LinkCandidate, linkType: StatementLinkType = "settlement") => {
    if (!direction) return;
    if (links.some((l) => l.groupId === c.id && l.groupKind === direction)) {
      toast.warning("既に追加されています");
      return;
    }
    if (linkType === "fee") {
      if (links.length > 0 || allocatedSum > 0) {
        toast.warning("手数料は入出金履歴1行全体を1つのグループに紐付ける時だけ選べます");
        return;
      }
      setLinks([
        {
          groupKind: direction,
          groupId: c.id,
          groupLabel: c.label,
          counterpartyName: c.counterpartyName,
          amount: totalAmount,
          linkType: "fee",
          note: "支払手数料",
          isCrossCompany: c.isCrossCompany,
          operatingCompanyName: c.operatingCompanyName,
          crossCompanyReason: "",
        },
      ]);
      return;
    }
    const groupRemaining = candidateRemainingAmount(c);
    const defaultAmount = Math.max(
      0,
      Math.min(remaining, groupRemaining ?? remaining)
    );
    if (defaultAmount <= 0) {
      toast.warning("残り紐付け可能額がありません");
      return;
    }
    setLinks((prev) => [
      ...prev,
      {
        groupKind: direction,
        groupId: c.id,
        groupLabel: c.label,
        counterpartyName: c.counterpartyName,
        amount: defaultAmount,
        linkType: "settlement",
        note: "",
        isCrossCompany: c.isCrossCompany,
        operatingCompanyName: c.operatingCompanyName,
        crossCompanyReason: "",
      },
    ]);
  };

  const handleToggleCrossCompany = async () => {
    const next = !includeCrossCompany;
    setIncludeCrossCompany(next);
    if (next) {
      toast.info("別法人候補を表示します。保存時に理由が必要です。");
    }
    const res = await listLinkCandidatesForEntry({
      entryId: entry.id,
      search,
      includeCrossCompany: next,
      includeFeeTargets: feeTargetMode,
    });
    if (res.ok) {
      setCandidates(res.data.candidates);
    } else {
      toast.error(res.error);
    }
  };

  const updateLink = (idx: number, patch: Partial<EditableLink>) => {
    setLinks((prev) =>
      prev.map((l, i) => (i === idx ? { ...l, ...patch } : l))
    );
  };

  const removeLink = (idx: number) => {
    setLinks((prev) => prev.filter((_, i) => i !== idx));
  };

  const performSave = async (resolution?: ConflictResolution) => {
    setSaving(true);
    try {
      for (const l of links) {
        if (!Number.isInteger(l.amount) || l.amount <= 0) {
          toast.error(`金額は1円以上の整数で入力してください: ${l.groupLabel}`);
          return;
        }
        if (l.isCrossCompany && !l.crossCompanyReason.trim()) {
          toast.error(`別法人紐付け理由を選択してください: ${l.groupLabel}`);
          return;
        }
        if (l.linkType === "fee" && l.amount !== totalAmount) {
          toast.error("手数料は入出金履歴1行の全額で紐付けてください");
          return;
        }
      }
      if (hasFeeLink && links.length > 1) {
        toast.error("手数料として紐付ける場合は、1つのグループだけに紐付けてください");
        return;
      }
      if (links.length > 0 && allocatedSum > totalAmount) {
        toast.error(
          `紐付け金額の合計（${allocatedSum.toLocaleString("ja-JP")}円）が取引金額（${totalAmount.toLocaleString("ja-JP")}円）を超えています`
        );
        return;
      }

      const res = await replaceLinksForEntry({
        entryId: entry.id,
        links: links.map((l) => ({
          groupKind: l.groupKind,
          groupId: l.groupId,
          amount: l.amount,
          linkType: l.linkType,
          note: l.note || null,
          crossCompanyReason: l.isCrossCompany ? l.crossCompanyReason : null,
        })),
        conflictResolution: resolution,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      if (res.data.status === "conflicts") {
        setConflicts(res.data.conflicts);
        return;
      }
      toast.success(`${res.data.count}件の紐付けを保存しました`);
      setConflicts(null);
      onOpenChange(false);
      onSaved?.();
    } finally {
      setSaving(false);
    }
  };

  const handleSave = () => performSave();
  const handleResolveConflict = (resolution: ConflictResolution) => {
    setConflicts(null);
    performSave(resolution);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="wide" className="max-h-[85vh] overflow-y-auto overflow-x-hidden">
        <DialogHeader>
          <DialogTitle>請求/支払グループへの紐付け</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Entry header */}
          <div className="rounded-md border p-3 bg-muted/30 text-sm space-y-1">
            <div className="flex items-center gap-2">
              <Badge variant="outline">{entry.transactionDate}</Badge>
              {entry.incomingAmount && entry.incomingAmount > 0 && (
                <Badge className="bg-green-600">
                  入金 {fmt(entry.incomingAmount)} 円
                </Badge>
              )}
              {entry.outgoingAmount && entry.outgoingAmount > 0 && (
                <Badge variant="destructive">
                  出金 {fmt(entry.outgoingAmount)} 円
                </Badge>
              )}
            </div>
            <div className="text-xs text-muted-foreground">
              {entry.description}
            </div>
            <div className="text-xs flex gap-4">
              <span>
                割当合計: <strong>{fmt(allocatedSum)}</strong> 円
              </span>
              <span className={remaining < 0 ? "text-red-600" : ""}>
                未紐付け残額: <strong>{fmt(remaining)}</strong> 円
              </span>
            </div>
          </div>

          {direction === null && !loading && (
            <p className="text-sm text-muted-foreground">
              入金額・出金額のどちらも0のため紐付けできません
            </p>
          )}

          {/* Existing links */}
          {direction !== null && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">紐付け中のグループ</Label>
                <span className="text-xs text-muted-foreground">
                  {direction === "invoice" ? "入金 → 請求" : "出金 → 支払"}
                </span>
              </div>
              {links.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  まだ紐付いていません
                </p>
              ) : (
                <div className="border rounded-md divide-y">
                  {links.map((l, idx) => (
                    <div
                      key={`${l.groupKind}-${l.groupId}-${l.linkType}`}
                      className="space-y-2 p-2 text-sm"
                    >
                      <div className="grid grid-cols-[minmax(0,1fr)_6rem_7rem_minmax(0,9rem)_2rem] items-start gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-1 min-w-0">
                            <span className="font-medium truncate">
                              {l.groupLabel}
                            </span>
                            {l.linkType === "fee" && (
                              <Badge variant="outline" className="shrink-0 border-orange-200 bg-orange-50 text-[10px] text-orange-800">
                                手数料
                              </Badge>
                            )}
                            {l.isCrossCompany && (
                              <Badge variant="outline" className="shrink-0 border-amber-200 bg-amber-50 text-[10px] text-amber-800">
                                別法人
                              </Badge>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground truncate">
                            {l.counterpartyName}
                            {l.operatingCompanyName ? ` / ${l.operatingCompanyName}` : ""}
                          </div>
                        </div>
                        <Select
                          value={l.linkType}
                          onValueChange={(value) => {
                            const nextType = value as StatementLinkType;
                            if (nextType === "fee" && links.length > 1) {
                              toast.warning("手数料は1行全体を1つのグループに紐付ける時だけ選べます");
                              return;
                            }
                            updateLink(idx, {
                              linkType: nextType,
                              amount: nextType === "fee" ? totalAmount : l.amount,
                            });
                          }}
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="settlement">通常</SelectItem>
                            <SelectItem value="fee">手数料</SelectItem>
                          </SelectContent>
                        </Select>
                        <Input
                          type="number"
                          value={l.amount}
                          onChange={(e) =>
                            updateLink(idx, {
                              amount: parseInt(e.target.value || "0", 10),
                            })
                          }
                          className="h-8 w-full text-xs"
                          placeholder="金額"
                          disabled={l.linkType === "fee"}
                        />
                        <Input
                          value={l.note}
                          onChange={(e) =>
                            updateLink(idx, { note: e.target.value })
                          }
                          className="h-8 w-full text-xs"
                          placeholder="メモ（任意）"
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          onClick={() => removeLink(idx)}
                          aria-label="紐付けを削除"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                      {l.isCrossCompany && (
                        <div className="grid grid-cols-[8rem_minmax(0,1fr)] items-center gap-2 rounded-md border border-amber-200 bg-amber-50 p-2">
                          <span className="text-xs font-medium text-amber-900">
                            別法人理由
                          </span>
                          <Select
                            value={l.crossCompanyReason}
                            onValueChange={(value) =>
                              updateLink(idx, { crossCompanyReason: value })
                            }
                          >
                            <SelectTrigger className="h-8 bg-white text-xs">
                              <SelectValue placeholder="理由を選択" />
                            </SelectTrigger>
                            <SelectContent>
                              {CROSS_COMPANY_REASON_OPTIONS.map((reason) => (
                                <SelectItem key={reason} value={reason}>
                                  {reason}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Candidate search */}
          {direction !== null && (
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label className="text-sm font-medium">候補から追加</Label>
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setCreateOpen(true)}
                    className="h-8"
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    {direction === "invoice" ? "請求グループを作成" : "支払グループを作成"}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={includeCrossCompany ? "default" : "outline"}
                    onClick={handleToggleCrossCompany}
                    className="h-8"
                  >
                    {includeCrossCompany ? "別法人候補を表示中" : "別法人の候補も表示"}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={feeTargetMode ? "default" : "outline"}
                    onClick={async () => {
                      const next = !feeTargetMode;
                      setFeeTargetMode(next);
                      const res = await listLinkCandidatesForEntry({
                        entryId: entry.id,
                        search,
                        includeCrossCompany,
                        includeFeeTargets: next,
                      });
                      if (res.ok) setCandidates(res.data.candidates);
                      else toast.error(res.error);
                    }}
                    className="h-8"
                  >
                    {feeTargetMode ? "手数料候補を表示中" : "手数料として紐付け"}
                  </Button>
                </div>
              </div>
              {includeCrossCompany && (
                <div className="rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">
                  別法人の候補を表示しています。別法人に紐付ける行は保存時に理由が必要です。
                </div>
              )}
              <div className="relative">
                <Search className="absolute left-2 top-2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    refreshCandidates(e.target.value);
                  }}
                  placeholder={
                    direction === "invoice"
                      ? "請求書番号 / 取引先名で検索"
                      : "管理番号 / 取引先名で検索"
                  }
                  className="pl-8 h-8 text-xs"
                />
              </div>
              <div className="border rounded-md max-h-72 overflow-y-auto divide-y">
                {loading ? (
                  <div className="p-3 text-xs flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    読み込み中...
                  </div>
                ) : candidates.length === 0 ? (
                  <div className="p-3 text-xs text-muted-foreground">
                    候補がありません
                  </div>
                ) : (
                  candidates.map((c) => {
                    const linked = links.some(
                      (l) => l.groupId === c.id && l.groupKind === direction
                    );
                    const groupRemaining = candidateRemainingAmount(c);
                    return (
                      <div
                        key={c.id}
                        className="p-2 text-xs flex items-center gap-2 hover:bg-muted/40"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1 min-w-0">
                            <span className="font-medium truncate">{c.label}</span>
                            {c.isCrossCompany && (
                              <Badge variant="outline" className="shrink-0 border-amber-200 bg-amber-50 text-[10px] text-amber-800">
                                別法人
                              </Badge>
                            )}
                          </div>
                          <div className="text-muted-foreground truncate">
                            {c.counterpartyName}
                            {c.expectedDate && ` / 予定 ${c.expectedDate}`}
                            {c.isCrossCompany && ` / ${c.operatingCompanyName}`}
                          </div>
                        </div>
                        <div className="text-right whitespace-nowrap">
                          <div>合計 {fmt(c.totalAmount)}</div>
                          {c.alreadyLinkedAmount > 0 && (
                            <div className="text-muted-foreground">
                              既割当 {fmt(c.alreadyLinkedAmount)}
                            </div>
                          )}
                          {groupRemaining !== null && (
                            <div className={groupRemaining <= 0 ? "text-red-600" : "text-muted-foreground"}>
                              残額 {fmt(groupRemaining)}
                            </div>
                          )}
                        </div>
                        {c.statementLinkCompleted && (
                          <Badge variant="secondary" className="text-[10px]">
                            完了
                          </Badge>
                        )}
                        <Button
                          size="sm"
                          variant={linked ? "ghost" : "outline"}
                          disabled={linked}
                          onClick={() => addCandidate(c, feeTargetMode ? "fee" : "settlement")}
                        >
                          <Plus className="h-3 w-3 mr-1" />
                          {linked ? "追加済" : feeTargetMode ? "手数料" : "追加"}
                        </Button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            キャンセル
          </Button>
          <Button
            onClick={handleSave}
            disabled={
              saving ||
              direction === null ||
              (links.length > 0 && allocatedSum > totalAmount)
            }
            title={
              links.length > 0 && allocatedSum > totalAmount
                ? "割当合計が取引金額を超えています"
                : undefined
            }
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                保存中
              </>
            ) : (
              "保存"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>

      <ConflictResolutionDialog
        open={conflicts !== null}
        conflicts={conflicts ?? []}
        onResolve={handleResolveConflict}
        onCancel={() => setConflicts(null)}
      />
      {direction && (
        <AccountingGroupCreateModal
          open={createOpen}
          onOpenChange={setCreateOpen}
          sourceEntryId={entry.id}
          initialKind={direction}
          onCreated={() => {
            load();
            onSaved?.();
          }}
        />
      )}
    </Dialog>
  );
}
